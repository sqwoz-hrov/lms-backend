import { ApiProperty } from '@nestjs/swagger';
import { FullSubscription } from '../subscription.repository';

class SubscriptionTierSummaryDto {
	@ApiProperty()
	id!: string;

	@ApiProperty()
	name!: string;

	@ApiProperty({ type: [String] })
	permissions!: string[];
}

class CurrentSubscriptionTierDto extends SubscriptionTierSummaryDto {
	@ApiProperty()
	priceRubles!: number;

	@ApiProperty()
	power!: number;

	@ApiProperty({ type: String, nullable: true })
	until!: string | null;
}

class GiftSubscriptionTierDto extends SubscriptionTierSummaryDto {
	@ApiProperty({ type: String })
	until!: string;
}

class NextPaymentDto {
	@ApiProperty()
	amount!: number;

	@ApiProperty({ type: String, nullable: true })
	date!: string | null;
}

export class GetSubscriptionResponseDto {
	@ApiProperty()
	billingPeriodDays!: number;

	@ApiProperty({ description: 'Остаток суммы успешных оплат после вычета стоимости всех подарков самому себе' })
	selfGiftAllowanceRubles!: number;

	@ApiProperty({ type: GiftSubscriptionTierDto, nullable: true })
	currentGiftTier!: GiftSubscriptionTierDto | null;

	@ApiProperty({ type: CurrentSubscriptionTierDto })
	currentTier!: CurrentSubscriptionTierDto;

	@ApiProperty({ type: SubscriptionTierSummaryDto })
	nextTier!: SubscriptionTierSummaryDto;

	@ApiProperty({ type: NextPaymentDto })
	nextPayment!: NextPaymentDto;

	static fromEntity(entity: FullSubscription): GetSubscriptionResponseDto {
		const dto = new GetSubscriptionResponseDto();
		dto.billingPeriodDays = entity.billingPeriodDays;
		dto.selfGiftAllowanceRubles = entity.selfGiftAllowanceRubles;
		dto.currentGiftTier = entity.currentGiftTier
			? {
					id: entity.currentGiftTier.id,
					name: entity.currentGiftTier.name,
					until: entity.currentGiftTier.until.toISOString(),
					permissions: entity.currentGiftTier.permissions,
				}
			: null;
		dto.currentTier = {
			id: entity.currentTier.id,
			priceRubles: entity.currentTier.priceRubles,
			power: entity.currentTier.power,
			name: entity.currentTier.name,
			until: entity.currentTier.until ? entity.currentTier.until.toISOString() : null,
			permissions: entity.currentTier.permissions,
		};
		dto.nextTier = {
			id: entity.nextTier.id,
			name: entity.nextTier.name,
			permissions: entity.nextTier.permissions,
		};
		dto.nextPayment = {
			amount: entity.nextPayment.amount,
			date: entity.nextPayment.date ? entity.nextPayment.date.toISOString() : null,
		};
		return dto;
	}
}
