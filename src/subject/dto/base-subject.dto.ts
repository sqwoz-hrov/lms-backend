import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class BaseSubjectDto {
	@ApiProperty()
	@IsString()
	@IsNotEmpty()
	id: string;

	@ApiProperty()
	@IsString()
	@IsNotEmpty()
	name: string;

	@ApiProperty()
	@IsString()
	@IsNotEmpty()
	color_code: string;
}

export class SubjectResponseDto extends BaseSubjectDto {
	@ApiProperty({ required: false, format: 'uuid' })
	@IsUUID()
	@IsOptional()
	minimal_tier_id?: string;
}
