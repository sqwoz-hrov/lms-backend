import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { UserWithNullableSubscriptionTier } from '../../../user/user.entity';
import { GiftRepository } from '../../gift.repository';
import { GiftAcceptedResponseType } from '../../dto/gift-accept-response.dto';

// PATCH /subscription/gift/:id
@Injectable()
export class AcceptGiftedSubscriptionUsecase implements UsecaseInterface {
	private logger = new Logger(AcceptGiftedSubscriptionUsecase.name);

	constructor(
		private readonly giftRepository: GiftRepository,
	) {}

	async execute({ giftRecipient, giftId }: { giftRecipient: UserWithNullableSubscriptionTier; giftId: string }): Promise<GiftAcceptedResponseType | null> {
		const now = new Date();
		if (giftRecipient.role !== 'subscriber') {
			this.logger.debug(`Cannot use gift as a non-subscriber user of role ${giftRecipient.role} with id ${giftRecipient.id}`)
			throw new BadRequestException(`Cannot use gift as a non-subscriber`);
		}

		const gift = await this.giftRepository.findById(giftId);

		if (!gift || gift.gifted_to !== giftRecipient.id) {
			this.logger.debug(`Gift with id ${giftId} is not gifted to user with id ${giftRecipient.id}`)
			throw new NotFoundException('Gift not found');
		}

		if (giftRecipient.subscription.is_gifted) {
			this.logger.debug(`Cannot use gift with an already active gifted subscription for user ${giftRecipient.id}`)
			throw new BadRequestException('Already have an active gifted subscription');
		}

		if (gift.tier.power < giftRecipient.subscription_tier.power) {
			this.logger.debug(`Cannot accept a lower tier gift. Gift tier: ${gift.tier.tier} (${gift.tier.power}), current subscription tier: ${giftRecipient.subscription_tier.tier} (${giftRecipient.subscription_tier.power}) for user ${giftRecipient.id}`);
			throw new BadRequestException('Cannot accept a lower tier gift');
		}

		const activatedGift = await this.giftRepository.activateGift(giftRecipient.id, giftId);

		return {
			activateAt: activatedGift.activated_at!.toISOString(),
			activeUntil: new Date(activatedGift.activated_at!.getTime() + activatedGift.duration_days * 24 * 60 * 60 * 1000).toISOString() ,
			giftTierId: activatedGift.tier_id
		};

	}
}
