import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { UserWithSubscriptionTier } from '../../../user/user.entity';
import { SubscriptionRepository } from '../../../subscription/subscription.repository';
import { PaymentMethodResponseDto } from '../../dto/payment-method-response.dto';
import { YookassaClientPaymentMethodPort } from '../../../yookassa/services/yookassa-client.interface';
import { YOOKASSA_CLIENT } from '../../../yookassa/constants';
import { PaymentHistoryRepository } from '../../payment-history.repository';

@Injectable()
export class GetActivePaymentMethodUsecase implements UsecaseInterface {
	constructor(
		private readonly subscriptionRepository: SubscriptionRepository,
		private readonly paymentHistoryRepository: PaymentHistoryRepository,
		@Inject(YOOKASSA_CLIENT)
		private readonly yookassaPaymentMethodClient: YookassaClientPaymentMethodPort,
	) {}

	async execute({ user }: { user: UserWithSubscriptionTier }): Promise<PaymentMethodResponseDto> {
		const paymentMethod = await this.subscriptionRepository.findPaymentMethodByUserId(user.id, undefined, {
			status: 'active',
		});

		if (!paymentMethod) {
			throw new NotFoundException('Payment method not found');
		}

		const subscription = await this.subscriptionRepository.findByUserIdWithTiers(user.id);
		const problemsWithPaymentMethod = await this.paymentHistoryRepository.hasProblemsWithPaymentMethod(
			user.id,
			paymentMethod.payment_method_id,
		);

		try {
			const remotePaymentMethod = await this.yookassaPaymentMethodClient.getPaymentMethod({
				paymentMethodId: paymentMethod.payment_method_id,
			});

			return PaymentMethodResponseDto.fromSources(
				paymentMethod,
				remotePaymentMethod,
				subscription,
				problemsWithPaymentMethod,
			);
		} catch {
			throw new NotFoundException('Payment method not found');
		}
	}
}
