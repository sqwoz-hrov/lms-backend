import { PartialType, OmitType, PickType, IntersectionType } from '@nestjs/swagger';
import { BaseHrConnectionDto } from './base-hr-connection.dto';

export class UpdateHrConnectionDto extends IntersectionType(
	PickType(BaseHrConnectionDto, ['id']),
	PartialType(OmitType(BaseHrConnectionDto, ['id', 'created_at'])),
) {}
