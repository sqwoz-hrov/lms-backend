import { PartialType, PickType } from '@nestjs/swagger';
import { BaseMaterialDto } from './base-material.dto';

export class GetMaterialsDto extends PartialType(
	PickType(BaseMaterialDto, ['student_user_id', 'subject_id', 'is_archived']),
) {}
