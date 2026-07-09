import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { UserRepository } from '../../../user/user.repository';
import { SubscriptionTierRepository } from '../../../subscription-tier/subscription-tier.repository';
import { GiftSubscriptionDto } from '../../dto/gift-subscription.dto';
import { GiftRepository } from '../../gift.repository';
import { GiftSubscriptionResponseDto } from '../../dto/gift-response.dto';

@Injectable()
export class GiftSubscriptionUsecase implements UsecaseInterface {
	constructor(
		private readonly giftRepository: GiftRepository,
		private readonly subscriptionTierRepository: SubscriptionTierRepository,
		private readonly userRepository: UserRepository,
	) {}

	async execute(params: { payload: GiftSubscriptionDto, actor: string }): Promise<GiftSubscriptionResponseDto | null> {
		const { payload, actor } = params;

		const giftTo = await this.userRepository.findById(payload.giftToUserId);
		if (!giftTo) {
			throw new NotFoundException('User not found');
		}

		if (giftTo.role === 'user' || giftTo.role === 'admin') {
			throw new BadRequestException(`Can't gift subscription to a non-subscriber user`);
		}

		const targetTier = await this.subscriptionTierRepository.findById(payload.subscriptionTierId);
		if (!targetTier) {
			throw new NotFoundException('Subscription tier not found');
		}

		if (targetTier.power === 0) {
			throw new BadRequestException(`Can't gift free tier subscription`);
		}

		const gift = await this.giftRepository.create({
			gifted_to: payload.giftToUserId,
			gifted_by: actor,
			tier_id: payload.subscriptionTierId,
			duration_days: payload.durationDays ?? 30,
		});

		return {
			giftToUserId: gift.gifted_to,
			giftedToUsername: giftTo.name,
			giftedToEmail: giftTo.email,
			subscriptionTierName: targetTier.tier,
			durationDays: gift.duration_days,
		};
	}
}
