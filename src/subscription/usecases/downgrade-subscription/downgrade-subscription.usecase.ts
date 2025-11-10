import { Injectable, NotFoundException } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { SubscriptionManagerFactory } from '../../domain/subscription-manager.factory';
import { DowngradeSubscriptionDto } from '../../dto/downgrade-subscription.dto';
import { SubscriptionResponseDto } from '../../dto/subscription-response.dto';
import { SubscriptionTierRepository } from '../../../subscription-tier/subscription-tier.repository';
import { SubscriptionRepository } from '../../subscription.repository';
import { SubscriptionActionExecutor } from '../../services/subscription-action.executor';
import { UserWithSubscriptionTier } from '../../../user/user.entity';

@Injectable()
export class DowngradeSubscriptionUsecase implements UsecaseInterface {
	constructor(
		private readonly subscriptionRepository: SubscriptionRepository,
		private readonly subscriptionTierRepository: SubscriptionTierRepository,
		private readonly subscriptionManagerFactory: SubscriptionManagerFactory,
		private readonly subscriptionActionExecutor: SubscriptionActionExecutor,
	) {}

	async execute(params: {
		payload: DowngradeSubscriptionDto;
		user: UserWithSubscriptionTier;
	}): Promise<SubscriptionResponseDto> {
		const { payload, user } = params;

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

			const lockedSubscription = await this.subscriptionRepository.lockByUserId(lockedUser.id, trx);
			if (!lockedSubscription) {
				throw new NotFoundException('Subscription not found');
			}

			const { action } = manager.handleDowngrade({
				subscription: lockedSubscription,
				targetTier,
			});

			const persisted = await this.subscriptionActionExecutor.execute({
				action,
				trx,
			});

			if (!persisted) {
				throw new NotFoundException('Subscription not found');
			}

			return SubscriptionResponseDto.fromEntity(persisted);
		});
	}
}
