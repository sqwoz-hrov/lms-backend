import { OmitType } from '@nestjs/swagger';
import { BaseSubscriptionTierDto } from './base-subscription-tier.dto';

export class CreateSubscriptionTierDto extends OmitType(BaseSubscriptionTierDto, ['id']) {}
