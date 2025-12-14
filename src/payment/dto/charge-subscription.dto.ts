import { ApiProperty } from '@nestjs/swagger';
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

	@ApiProperty({ description: 'Ссылка подтверждения оплаты, когда YooKassa требует дополнительное действие' })
	confirmationUrl: string;

	static fromYookassa(payment: YookassaPaymentResponse): ChargeSubscriptionResponseDto {
		const amount = Number.parseFloat(payment.amount.value);
		if (!Number.isFinite(amount) || amount <= 0) {
			throw new Error('Invalid payment amount received from YooKassa');
		}

		const confirmationUrl = payment.confirmation?.confirmation_url;
		if (!confirmationUrl) {
			throw new Error('Missing confirmation URL in YooKassa response');
		}

		return {
			paymentId: payment.id,
			status: payment.status,
			paid: payment.paid,
			amountRubles: amount,
			createdAt: payment.created_at,
			confirmationUrl,
		};
	}
}
