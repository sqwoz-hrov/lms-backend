import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { MaterialType } from '../material.entity';

const MaterialTypes: MaterialType[] = ['article', 'video', 'other'];

export class BaseMaterialDto {
	@ApiProperty()
	@IsString()
	@IsNotEmpty()
	id: string;

	@ApiProperty({ required: false, type: 'string' })
	@IsUUID()
	@IsOptional()
	student_user_id?: string | undefined;

	@ApiProperty()
	@IsString()
	@IsNotEmpty()
	subject_id: string;

	@ApiProperty()
	@IsString()
	@IsNotEmpty()
	name: string;

	@ApiProperty({ enum: MaterialTypes })
	@IsEnum(MaterialTypes)
	@IsNotEmpty()
	type: MaterialType;

	@ApiProperty({ required: false, type: 'string' })
	@IsString()
	@IsOptional()
	video_id: string | undefined;

	@ApiProperty({ required: false })
	@IsString()
	@IsOptional()
	markdown_content_id: string | undefined;

	@ApiProperty({ description: 'Resolved markdown content as text', required: false, type: 'string' })
	@IsString()
	@IsOptional()
	markdown_content: string | undefined;

	@ApiProperty()
	@IsBoolean()
	is_archived: boolean;
}

export class MaterialResponseDto extends BaseMaterialDto {}
