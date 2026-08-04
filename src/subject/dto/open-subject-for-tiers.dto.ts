import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class OpenSubjectForTiersDto {
	@ApiProperty({ format: 'uuid' })
	@IsUUID()
	minimal_tier_id: string;
}
