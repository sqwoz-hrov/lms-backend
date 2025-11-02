import { PickType } from '@nestjs/swagger';
import { BaseSubscriptionTierDto } from './base-subscription-tier.dto';

export class DeleteSubscriptionTierDto extends PickType(BaseSubscriptionTierDto, ['id']) {}
