import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

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
	@ApiProperty({ required: false, type: [String] })
	@IsString({ each: true })
	@IsOptional()
	subscription_tier_ids?: string[];
}
