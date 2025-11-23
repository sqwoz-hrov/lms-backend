import { ApiProperty } from '@nestjs/swagger';
import { CreatePaymentMethodResponse } from '../../yookassa/services/yookassa-client.interface';

export class PaymentMethodConfirmationResponseDto {
	@ApiProperty({ description: 'Ссылка для подтверждения привязки способа оплаты' })
	confirmation_url: string;

	static fromYookassa(response: CreatePaymentMethodResponse): PaymentMethodConfirmationResponseDto {
		const confirmationUrl = response.confirmation?.confirmation_url;
		if (!confirmationUrl) {
			throw new Error('Missing confirmation URL in YooKassa response');
		}
		return { confirmation_url: confirmationUrl };
	}
}
