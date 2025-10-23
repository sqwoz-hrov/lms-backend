import { ApiProperty } from '@nestjs/swagger';
import { SubscriptionStatus, Subscription } from '../subscription.entity';

export class SubscriptionResponseDto {
	@ApiProperty()
	id!: string;

	@ApiProperty()
	userId!: string;

	@ApiProperty()
	subscriptionTierId!: string;

	@ApiProperty({ enum: ['pending', 'active', 'past_due', 'canceled'] satisfies SubscriptionStatus[] })
	status!: SubscriptionStatus;

	@ApiProperty()
	priceOnPurchaseRubles!: number;

	@ApiProperty()
	isGifted!: boolean;

	@ApiProperty()
	gracePeriodSize!: number;

	@ApiProperty()
	billingPeriodDays!: number;

	@ApiProperty({ nullable: true })
	paymentMethodId: string | null = null;

	@ApiProperty({ type: String })
	currentPeriodEnd!: string;

	@ApiProperty({ type: String, nullable: true })
	nextBillingAt: string | null = null;

	@ApiProperty()
	billingRetryAttempts!: number;

	@ApiProperty({ type: String, nullable: true })
	lastBillingAttempt: string | null = null;

	@ApiProperty({ type: String })
	createdAt!: string;

	@ApiProperty({ type: String })
	updatedAt!: string;

	static fromEntity(entity: Subscription): SubscriptionResponseDto {
		const dto = new SubscriptionResponseDto();
		dto.id = entity.id;
		dto.userId = entity.user_id;
		dto.subscriptionTierId = entity.subscription_tier_id;
		dto.status = entity.status;
		dto.priceOnPurchaseRubles = entity.price_on_purchase_rubles;
		dto.isGifted = entity.is_gifted;
		dto.gracePeriodSize = entity.grace_period_size;
		dto.billingPeriodDays = entity.billing_period_days;
		dto.paymentMethodId = entity.payment_method_id ?? null;
		dto.currentPeriodEnd = entity.current_period_end.toISOString();
		dto.nextBillingAt = entity.next_billing_at ? entity.next_billing_at.toISOString() : null;
		dto.billingRetryAttempts = entity.billing_retry_attempts;
		dto.lastBillingAttempt = entity.last_billing_attempt ? entity.last_billing_attempt.toISOString() : null;
		dto.createdAt = entity.created_at.toISOString();
		dto.updatedAt = entity.updated_at.toISOString();
		return dto;
	}
}
