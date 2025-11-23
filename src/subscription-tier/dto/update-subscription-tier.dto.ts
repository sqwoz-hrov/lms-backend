import { IntersectionType, PartialType, PickType } from '@nestjs/swagger';
import { BaseSubscriptionTierDto } from './base-subscription-tier.dto';

export class UpdateSubscriptionTierDto extends IntersectionType(
	PartialType(BaseSubscriptionTierDto),
	PickType(BaseSubscriptionTierDto, ['id']),
) {}
