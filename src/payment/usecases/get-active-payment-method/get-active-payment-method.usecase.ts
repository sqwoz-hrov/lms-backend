import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { UserWithSubscriptionTier } from '../../../user/user.entity';
import { SubscriptionRepository } from '../../../subscription/subscription.repository';
import { PaymentMethodResponseDto } from '../../dto/payment-method-response.dto';
import { YookassaClientPaymentMethodPort } from '../../../yookassa/services/yookassa-client.interface';
import { YOOKASSA_CLIENT } from '../../../yookassa/constants';

@Injectable()
export class GetActivePaymentMethodUsecase implements UsecaseInterface {
	constructor(
		private readonly subscriptionRepository: SubscriptionRepository,
		@Inject(YOOKASSA_CLIENT)
		private readonly yookassaPaymentMethodClient: YookassaClientPaymentMethodPort,
	) {}

	async execute({ user }: { user: UserWithSubscriptionTier }): Promise<PaymentMethodResponseDto> {
		const paymentMethod = await this.subscriptionRepository.findPaymentMethodByUserId(user.id);

		if (!paymentMethod) {
			throw new NotFoundException('Payment method not found');
		}

		try {
			const remotePaymentMethod = await this.yookassaPaymentMethodClient.getPaymentMethod({
				paymentMethodId: paymentMethod.payment_method_id,
			});

			return PaymentMethodResponseDto.fromSources(paymentMethod, remotePaymentMethod);
		} catch {
			throw new NotFoundException('Payment method not found');
		}
	}
}
