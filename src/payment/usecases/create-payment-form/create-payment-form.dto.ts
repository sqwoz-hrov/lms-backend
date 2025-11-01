import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { YookassaPaymentResponse } from '../../../yookassa/services/yookassa.client';

export class CreatePaymentFormDto {
	@ApiProperty({
		format: 'uuid',
		description: 'Целевой идентификатор тарифа подписки, для которого нужно создать оплату',
	})
	@IsUUID()
	subscription_tier_id: string;
}

export class PaymentFormResponseDto {
	@ApiProperty({ description: 'Идентификатор платежа в YooKassa' })
	@IsString()
	payment_id: string;

	@ApiProperty({ description: 'Текущий статус платежа' })
	@IsString()
	status: string;

	@ApiProperty({ description: 'Флаг успешной оплаты' })
	@IsBoolean()
	paid: boolean;

	@ApiProperty({ description: 'Сумма к оплате в рублях' })
	@IsNumber()
	amount_rubles: number;

	@ApiProperty({ description: 'Ссылка для подтверждения платежа', nullable: true })
	@IsString()
	@IsOptional()
	confirmation_url: string | null;

	static fromYookassa(payment: YookassaPaymentResponse): PaymentFormResponseDto {
		const amount = Number.parseFloat(payment.amount.value);
		if (!Number.isFinite(amount) || amount <= 0) {
			throw new Error('Invalid payment amount received from YooKassa');
		}
		return {
			payment_id: payment.id,
			status: payment.status,
			paid: payment.paid,
			amount_rubles: amount,
			confirmation_url: payment.confirmation?.confirmation_url ?? null,
		};
	}
}
