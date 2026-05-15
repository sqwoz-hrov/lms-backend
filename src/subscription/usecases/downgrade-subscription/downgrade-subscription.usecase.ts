import { HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { DowngradeSubscriptionDto } from '../../dto/downgrade-subscription.dto';
import { SubscriptionResponseDto } from '../../dto/subscription-response.dto';
import { SubscriptionTierRepository } from '../../../subscription-tier/subscription-tier.repository';
import { SubscriptionRepository } from '../../subscription.repository';
import { UserWithSubscriptionTier } from '../../../user/user.entity';

@Injectable()
export class DowngradeSubscriptionUsecase implements UsecaseInterface {
	constructor(
		private readonly subscriptionRepository: SubscriptionRepository,
		private readonly subscriptionTierRepository: SubscriptionTierRepository,
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

			if (targetTier.power >= lockedSubscription.tier_power) {
				throw new HttpException(
					`Cannot downgrade subscription tier from "${lockedSubscription.tier}" to "${targetTier.tier}"`,
					HttpStatus.CONFLICT,
				);
			}

			const persisted = await this.subscriptionRepository.update(
				lockedSubscription.id,
				{ next_tier_id: targetTier.id },
				trx,
			);

			if (!persisted) {
				throw new NotFoundException('Failed to update subscription');
			}

			return SubscriptionResponseDto.fromEntity(persisted);
		});
	}
}
