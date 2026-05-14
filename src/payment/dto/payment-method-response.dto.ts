import { ApiProperty } from '@nestjs/swagger';
import { Subscription } from '../../subscription/subscription.entity';
import {
	PAYMENT_METHOD_TYPES,
	YookassaPaymentMethod,
	YookassaPaymentMethodType,
} from '../../subscription/types/yookassa-webhook';
import { PaymentMethod } from '../payment.entity';

export class PaymentMethodResponseDto {
	@ApiProperty()
	userId: string;

	@ApiProperty()
	paymentMethodId: string;

	@ApiProperty({ enum: PAYMENT_METHOD_TYPES })
	type: YookassaPaymentMethodType;

	@ApiProperty({ nullable: true })
	last4: string | null;

	@ApiProperty()
	createdAt: string;

	@ApiProperty()
	updatedAt: string;

	@ApiProperty({ nullable: true })
	nextBillingAt: string | null;

	static fromSources(
		entity: PaymentMethod,
		remote: YookassaPaymentMethod,
		subscription?: Subscription,
	): PaymentMethodResponseDto {
		const dto = new PaymentMethodResponseDto();
		dto.userId = entity.user_id;
		dto.paymentMethodId = entity.payment_method_id;
		dto.type = remote.type;
		dto.last4 = remote.card?.last4 ?? null;
		dto.createdAt = entity.created_at.toISOString();
		dto.updatedAt = entity.updated_at.toISOString();
		dto.nextBillingAt = subscription?.current_period_end
			? new Date(subscription.current_period_end).toISOString()
			: null;
		return dto;
	}
}
