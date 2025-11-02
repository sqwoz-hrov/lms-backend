import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';

export class OpenMaterialForTiersDto {
	@ApiProperty({ type: [String] })
	@IsArray()
	@IsUUID('all', { each: true })
	tier_ids: string[];
}
