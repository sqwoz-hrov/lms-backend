import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';
import { YookassaPaymentResponse } from '../../yookassa/services/yookassa-client.interface';

export class CreatePaymentFormDto {
	@ApiProperty({
		format: 'uuid',
		description: 'Целевой идентификатор тарифа подписки, для которого нужно создать оплату',
	})
	@IsUUID()
	subscription_tier_id: string;
}

export class PaymentFormResponseDto {
	@ApiProperty({ description: 'Ссылка для подтверждения платежа', nullable: true })
	@IsString()
	confirmation_url: string;

	static fromYookassa(payment: YookassaPaymentResponse): PaymentFormResponseDto {
		const amount = Number.parseFloat(payment.amount.value);
		if (!Number.isFinite(amount) || amount <= 0) {
			throw new Error('Invalid payment amount received from YooKassa');
		}
		return {
			confirmation_url: payment.confirmation.confirmation_url,
		};
	}
}
