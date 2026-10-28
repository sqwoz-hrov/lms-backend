import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { SubscriptionTierRepository } from '../../../subscription-tier/subscription-tier.repository';
import { SubscriptionTier } from '../../../subscription-tier/subscription-tier.entity';
import { SubscriptionRepository } from '../../../subscription/subscription.repository';
import { UserWithSubscriptionTier } from '../../../user/user.entity';
import { YOOKASSA_CLIENT } from '../../../yookassa/constants';
import { YookassaClientPort } from '../../../yookassa/services/yookassa-client.interface';
import { ChargeSubscriptionResponseDto } from '../../dto/charge-subscription.dto';
import { calculateSubscriptionDiscount } from '../../subscription-purchase';

@Injectable()
export class ChargeSubscriptionUsecase implements UsecaseInterface {
	constructor(
		private readonly subscriptionTierRepository: SubscriptionTierRepository,
		private readonly subscriptionRepository: SubscriptionRepository,
		@Inject(YOOKASSA_CLIENT) private readonly yookassaClient: YookassaClientPort,
	) {}

	async execute(params: {
		current_tier_id: string;
		idempotenceKey: string;
		expectedAmountRubles: number;
		user: UserWithSubscriptionTier;
	}): Promise<ChargeSubscriptionResponseDto> {
		const { current_tier_id, idempotenceKey, user, expectedAmountRubles } = params;
		const targetTier = await this.subscriptionTierRepository.findActiveById(current_tier_id);
		if (!targetTier) throw new NotFoundException('Subscription tier not found');
		if (targetTier.price_rubles <= 0) throw new BadRequestException('Subscription tier is not billable');

		const amountRubles = await this.quote(user, targetTier);
		if (amountRubles !== expectedAmountRubles) throw new ConflictException('Subscription purchase price changed');
		if (amountRubles <= 0) throw new BadRequestException('Obtain a gift instead of charging');

		const paymentMethod = await this.subscriptionRepository.findPaymentMethodByUserId(user.id, undefined, {
			status: 'active',
		});
		if (!paymentMethod) throw new NotFoundException('Payment method not found');

		const payment = await this.yookassaClient.chargeSavedPaymentMethod({
			amountRubles,
			description: `Оплата подписки (${targetTier.tier})`,
			paymentMethodId: paymentMethod.payment_method_id,
			metadata: {
				current_tier_id: targetTier.id,
				user_id: user.id,
				purchase_mode: 'upgrade_discount',
			},
			idempotenceKey,
		});
		return ChargeSubscriptionResponseDto.fromYookassa(payment);
	}

	private async quote(user: UserWithSubscriptionTier, target: SubscriptionTier): Promise<number> {
		// User.subscription_tier resolves to the active gift; use the paid tier underneath it.
		const gifted = user.subscription.is_gifted
			? await this.subscriptionRepository.getFullSubscriptionByUser(user.id)
			: undefined;
		if (user.subscription.is_gifted && !gifted) throw new NotFoundException('Subscription not found');
		const current = gifted
			? { id: gifted.currentTier.id, power: gifted.currentTier.power, tier: gifted.currentTier.name }
			: user.subscription_tier;
		if (target.id === current.id) throw new BadRequestException('Subscription tier already purchased');
		if (target.power < current.power) {
			throw new BadRequestException(`Cannot downgrade subscription tier from "${current.tier}" to "${target.tier}"`);
		}
		return (
			target.price_rubles -
			calculateSubscriptionDiscount(
				{
					priceRubles: gifted?.currentTier.priceRubles ?? user.subscription_tier.price_rubles,
					paidUntil: user.subscription.current_period_end?.getTime() ?? 0,
					giftUntil: gifted?.currentGiftTier?.until.getTime() ?? 0,
					billingPeriodDays: user.subscription.billing_period_days,
				},
				Date.now(),
			)
		);
	}
}
