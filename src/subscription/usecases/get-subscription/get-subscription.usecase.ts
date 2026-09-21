import { Injectable, NotFoundException } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { UserWithSubscriptionTier } from '../../../user/user.entity';
import { GetSubscriptionResponseDto } from '../../dto/get-subscription-response.dto';
import { SubscriptionRepository } from '../../subscription.repository';

@Injectable()
export class GetSubscriptionUsecase implements UsecaseInterface {
	constructor(private readonly subscriptionRepository: SubscriptionRepository) {}

	async execute({ actor }: { actor: UserWithSubscriptionTier }): Promise<GetSubscriptionResponseDto> {
		const subscription = await this.subscriptionRepository.getFullSubscriptionByUser(actor.id);
		if (!subscription) {
			throw new NotFoundException('Subscription not found');
		}

		return GetSubscriptionResponseDto.fromEntity(subscription);
	}
}
