import { ApiProperty } from '@nestjs/swagger';
import { SubscriptionStatus, Subscription } from '../subscription.entity';

export class SubscriptionResponseDto {
	@ApiProperty()
	id: string;

	@ApiProperty()
	userId: string;

	@ApiProperty()
	subscriptionTierId: string;

	@ApiProperty({ enum: ['pending', 'active', 'canceled'] satisfies SubscriptionStatus[] })
	status: SubscriptionStatus;

	@ApiProperty()
	priceOnPurchaseRubles: number;

	@ApiProperty()
	isGifted: boolean;

	@ApiProperty()
	gracePeriodSize: number;

	@ApiProperty()
	billingPeriodDays: number;

	@ApiProperty({ nullable: true })
	paymentMethodId: string | null = null;

	@ApiProperty({ type: String, nullable: true })
	currentPeriodEnd: string | null = null;

	@ApiProperty({ type: String, nullable: true })
	lastBillingAttempt: string | null = null;

	@ApiProperty({ type: String })
	createdAt: string;

	@ApiProperty({ type: String })
	updatedAt: string;

	static fromEntity(entity: Subscription, extras?: { paymentMethodId?: string | null }): SubscriptionResponseDto {
		const dto = new SubscriptionResponseDto();
		dto.id = entity.id;
		dto.userId = entity.user_id;
		dto.subscriptionTierId = entity.subscription_tier_id;
		dto.status = entity.status;
		dto.priceOnPurchaseRubles = entity.price_on_purchase_rubles;
		dto.isGifted = entity.is_gifted;
		dto.gracePeriodSize = entity.grace_period_size;
		dto.billingPeriodDays = entity.billing_period_days;
		dto.paymentMethodId = extras?.paymentMethodId ?? null;
		dto.currentPeriodEnd = entity.current_period_end ? entity.current_period_end.toISOString() : null;
		dto.lastBillingAttempt = entity.last_billing_attempt ? entity.last_billing_attempt.toISOString() : null;
		dto.createdAt = entity.created_at.toISOString();
		dto.updatedAt = entity.updated_at.toISOString();
		return dto;
	}
}
