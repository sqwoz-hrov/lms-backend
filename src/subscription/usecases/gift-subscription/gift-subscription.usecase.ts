import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { UserRepository } from '../../../user/user.repository';
import { SubscriptionManagerFactory } from '../../domain/subscription-manager.factory';
import { GiftSubscriptionDto } from '../../dto/gift-subscription.dto';
import { SubscriptionResponseDto } from '../../dto/subscription-response.dto';
import { SubscriptionActionExecutor } from '../../services/subscription-action.executor';
import { SubscriptionTierRepository } from '../../subscription-tier.repository';
import { SubscriptionRepository } from '../../subscription.repository';

@Injectable()
export class GiftSubscriptionUsecase implements UsecaseInterface {
	constructor(
		private readonly subscriptionRepository: SubscriptionRepository,
		private readonly subscriptionTierRepository: SubscriptionTierRepository,
		private readonly subscriptionManagerFactory: SubscriptionManagerFactory,
		private readonly subscriptionActionExecutor: SubscriptionActionExecutor,
		private readonly userRepository: UserRepository,
	) {}

	async execute(params: { payload: GiftSubscriptionDto }): Promise<SubscriptionResponseDto | null> {
		const { payload } = params;

		const user = await this.userRepository.findById(payload.userId);
		if (!user) {
			throw new NotFoundException('User not found');
		}

		if (user.role === 'user' || user.role === 'admin') {
			throw new BadRequestException(`Can't gift subscription to a non-subscriber user`);
		}

		const targetTier = await this.subscriptionTierRepository.findById(payload.subscriptionTierId);
		if (!targetTier) {
			throw new NotFoundException('Subscription tier not found');
		}

		const manager = await this.subscriptionManagerFactory.create();

		return await this.subscriptionRepository.transaction(async trx => {
			const lockedUser = await trx
				.selectFrom('user')
				.selectAll()
				.where('id', '=', user.id)
				.forUpdate()
				.limit(1)
				.executeTakeFirst();

			if (!lockedUser) {
				throw new NotFoundException('User not found');
			}

			const existing = await this.subscriptionRepository.findByUserId(user.id, trx);
			const lockedSubscription = existing?.id
				? await this.subscriptionRepository.lockById(existing.id, trx)
				: undefined;

			const { action } = manager.handleGift({
				user: lockedUser,
				targetTier,
				durationDays: payload.durationDays ?? 30,
				existingSubscription: lockedSubscription ?? undefined,
			});

			const persisted = await this.subscriptionActionExecutor.execute({
				action,
				trx,
			});

			if (!persisted) {
				return null;
			}

			const paymentMethod = await this.subscriptionRepository.findPaymentMethodByUserId(lockedUser.id, trx);

			return SubscriptionResponseDto.fromEntity(persisted, {
				paymentMethodId: paymentMethod?.payment_method_id ?? null,
			});
		});
	}
}
