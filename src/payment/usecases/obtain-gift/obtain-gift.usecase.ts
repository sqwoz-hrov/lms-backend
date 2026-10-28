import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { sql } from 'kysely';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { GiftRepository } from '../../../gift/gift.repository';
import { SubscriptionTierRepository } from '../../../subscription-tier/subscription-tier.repository';
import { SubscriptionRepository } from '../../../subscription/subscription.repository';
import { UserWithSubscriptionTier } from '../../../user/user.entity';
import { ObtainGiftResponseDto } from '../../dto/obtain-gift.dto';
import { calculateSubscriptionDiscount } from '../../subscription-purchase';

@Injectable()
export class ObtainGiftUsecase implements UsecaseInterface {
	constructor(
		private readonly subscriptionRepository: SubscriptionRepository,
		private readonly subscriptionTierRepository: SubscriptionTierRepository,
		private readonly giftRepository: GiftRepository,
	) {}

	async execute(params: {
		user: UserWithSubscriptionTier;
		current_tier_id: string;
		idempotenceKey: string;
	}): Promise<ObtainGiftResponseDto> {
		const { user, current_tier_id, idempotenceKey } = params;
		return this.subscriptionRepository.transaction(async trx => {
			// Serialize claims so parallel requests cannot spend the same allowance twice.
			const aggregation = await this.subscriptionRepository.lockSubscriptionByUserId(user.id, trx);
			if (!aggregation) throw new NotFoundException('Subscription not found');
			const previous = await trx
				.selectFrom('payment_event')
				.select('event')
				.where('user_id', '=', user.id)
				.where(sql<string>`event ->> 'type'`, '=', 'subscription.gift-obtained')
				.where(sql<string>`event ->> 'idempotenceKey'`, '=', idempotenceKey)
				.limit(1)
				.executeTakeFirst();
			if (previous) {
				const event = previous.event as { tierId: string; giftId: string; durationDays: number };
				if (event.tierId !== current_tier_id)
					throw new BadRequestException('Idempotence key already used for another tier');
				return { giftId: event.giftId, durationDays: event.durationDays };
			}
			const target = await this.subscriptionTierRepository.findActiveById(current_tier_id);
			if (!target) throw new NotFoundException('Subscription tier not found');
			if (target.price_rubles <= 0) throw new BadRequestException('Subscription tier is not billable');
			const { subscription: paid, currentTier } = aggregation.currentPaidSubscription;
			const discount = calculateSubscriptionDiscount(
				{
					priceRubles: currentTier.price_rubles,
					paidUntil: paid.current_period_end?.getTime() ?? 0,
					giftUntil: aggregation.currentActiveGiftSubscription?.gift.until?.getTime() ?? 0,
					billingPeriodDays: paid.billing_period_days,
				},
				Date.now(),
			);
			if (target.power < currentTier.power) throw new BadRequestException('Cannot obtain a lower tier gift');
			if (discount < target.price_rubles)
				throw new ConflictException('Subscription discount no longer covers this tier');
			const allowance = await this.subscriptionRepository.getSelfGiftAllowance(user.id, trx);
			if (allowance < target.price_rubles) throw new ConflictException('Insufficient subscription gift allowance');
			const gift = await this.giftRepository.create(
				{
					gifted_to: user.id,
					gifted_by: user.id,
					tier_id: target.id,
					duration_days: paid.billing_period_days,
					activated_at: null,
				},
				trx,
			);
			const response = { giftId: gift.id, durationDays: gift.duration_days };
			await this.subscriptionRepository.insertPaymentEvent(
				{
					user_id: user.id,
					subscription_id: paid.id,
					event: {
						type: 'subscription.gift-obtained',
						idempotenceKey,
						tierId: target.id,
						amountRubles: target.price_rubles,
						...response,
					},
				},
				trx,
			);
			return response;
		});
	}
}
