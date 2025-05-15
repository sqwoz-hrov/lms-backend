import { PartialType, OmitType, PickType, IntersectionType } from '@nestjs/swagger';
import { BaseInterviewDto } from './base-interview.dto';

export class UpdateInterviewDto extends IntersectionType(
	PickType(BaseInterviewDto, ['id']),
	PartialType(OmitType(BaseInterviewDto, ['id', 'created_at'])),
) {}
