import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

export class OpenMaterialForTiersDto {
	@ApiProperty({ type: [String] })
	@IsArray()
	@ArrayNotEmpty()
	@IsUUID('all', { each: true })
	tier_ids: string[];
}
