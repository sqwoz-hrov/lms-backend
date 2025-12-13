import { Injectable, NotFoundException } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { UserWithSubscriptionTier } from '../../../user/user.entity';
import { SubscriptionRepository } from '../../../subscription/subscription.repository';

@Injectable()
export class DeletePaymentMethodUsecase implements UsecaseInterface {
	constructor(private readonly subscriptionRepository: SubscriptionRepository) {}

	async execute({ user }: { user: UserWithSubscriptionTier }): Promise<void> {
		const existing = await this.subscriptionRepository.findPaymentMethodByUserId(user.id);

		if (!existing) {
			throw new NotFoundException('Payment method not found');
		}

		await this.subscriptionRepository.deletePaymentMethodByUserId(user.id);
	}
}
