import { Inject, Injectable } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { UserWithSubscriptionTier } from '../../../user/user.entity';
import { PaymentMethodConfirmationResponseDto } from '../../dto/payment-method-confirmation-response.dto';
import { YOOKASSA_CLIENT } from '../../../yookassa/constants';
import { YookassaClientPaymentMethodPort } from '../../../yookassa/services/yookassa-client.interface';
import { SubscriptionRepository } from '../../../subscription/subscription.repository';

@Injectable()
export class AddPaymentMethodUsecase implements UsecaseInterface {
	constructor(
		private readonly subscriptionRepository: SubscriptionRepository,
		@Inject(YOOKASSA_CLIENT)
		private readonly yookassaPaymentMethodClient: YookassaClientPaymentMethodPort,
	) {}

	async execute({ user }: { user: UserWithSubscriptionTier }): Promise<PaymentMethodConfirmationResponseDto> {
		const response = await this.yookassaPaymentMethodClient.createPaymentMethod({
			type: 'bank_card',
		});

		await this.subscriptionRepository.upsertPaymentMethod({
			user_id: user.id,
			payment_method_id: response.id,
			status: 'pending',
		});

		return PaymentMethodConfirmationResponseDto.fromYookassa(response);
	}
}
