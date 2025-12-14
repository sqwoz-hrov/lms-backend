import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { YookassaPaymentResponse } from '../../yookassa/services/yookassa-client.interface';

export class ChargeSubscriptionDto {
	@ApiProperty({
		format: 'uuid',
		description: 'Целевой идентификатор тарифа подписки, для которого нужно создать оплату',
	})
	@IsUUID()
	subscription_tier_id: string;
}

export class ChargeSubscriptionResponseDto {
	@ApiProperty({ description: 'Идентификатор платежа в YooKassa' })
	paymentId: string;

	@ApiProperty({ description: 'Текущий статус платежа' })
	status: string;

	@ApiProperty({ description: 'Был ли платёж уже оплачен' })
	paid: boolean;

	@ApiProperty({ description: 'Сумма списания в рублях' })
	amountRubles: number;

	@ApiProperty({ description: 'Дата создания платежа' })
	createdAt: string;

	@ApiPropertyOptional({
		description: 'Ссылка подтверждения оплаты, когда YooKassa требует дополнительное действие',
		nullable: true,
	})
	confirmationUrl?: string;

	static fromYookassa(payment: YookassaPaymentResponse): ChargeSubscriptionResponseDto {
		const amount = Number.parseFloat(payment.amount.value);
		if (!Number.isFinite(amount) || amount <= 0) {
			throw new Error('Invalid payment amount received from YooKassa');
		}

		const confirmationUrl = payment.confirmation?.confirmation_url;
		const response: ChargeSubscriptionResponseDto = {
			paymentId: payment.id,
			status: payment.status,
			paid: payment.paid,
			amountRubles: amount,
			createdAt: payment.created_at,
		};

		if (confirmationUrl !== undefined) {
			response.confirmationUrl = confirmationUrl;
		}

		return response;
	}
}
