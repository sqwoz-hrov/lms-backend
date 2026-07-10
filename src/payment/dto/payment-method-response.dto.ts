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
	userId!: string;

	@ApiProperty()
	id!: string;

	@ApiProperty({ enum: PAYMENT_METHOD_TYPES })
	type!: YookassaPaymentMethodType;

	@ApiProperty({ nullable: true })
	last4!: string | null;

	@ApiProperty()
	createdAt!: string;

	@ApiProperty()
	updatedAt!: string;

	@ApiProperty({ nullable: true })
	nextBillingAt?: string | null;

	static fromSources(
		entity: PaymentMethod,
		remote: YookassaPaymentMethod,
		subscriptionAndTiers?: {
			subscription: Subscription,
			currentTier: { power: number; price: number; };
			nextTier: { power: number; price: number; }
		},
	): PaymentMethodResponseDto {
		const dto = new PaymentMethodResponseDto();
		dto.id = entity.id;
		dto.userId = entity.user_id;
		dto.type = remote.type;
		dto.last4 = remote.card?.last4 ?? null;
		dto.createdAt = entity.created_at.toISOString();
		dto.updatedAt = entity.updated_at.toISOString();

		if (subscriptionAndTiers) {
			dto.nextBillingAt = 
				subscriptionAndTiers.subscription.current_period_end
				&& subscriptionAndTiers.nextTier.price > 0 
				&& subscriptionAndTiers.nextTier.power > 0
					? subscriptionAndTiers.subscription.current_period_end.toISOString()
					: null;
		}
		return dto;
	}
}
