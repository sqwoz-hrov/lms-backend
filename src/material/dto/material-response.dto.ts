import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { BaseMaterialDto } from './base-material.dto';

export class MaterialResponseDto extends BaseMaterialDto {
	@ApiPropertyOptional({ format: 'uuid' })
	@IsUUID()
	@IsOptional()
	minimal_tier_id?: string;
}
