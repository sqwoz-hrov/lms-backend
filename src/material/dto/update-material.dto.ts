import { IntersectionType, PartialType, PickType } from '@nestjs/swagger';
import { BaseMaterialDto } from './base-material.dto';

export class UpdateMaterialDto extends IntersectionType(
	PartialType(BaseMaterialDto),
	PickType(BaseMaterialDto, ['id']),
) {}
