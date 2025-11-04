import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class BasePostDto {
	@ApiProperty()
	@IsUUID()
	@IsNotEmpty()
	id: string;

	@ApiProperty()
	@IsString()
	@IsNotEmpty()
	title: string;

	@ApiProperty()
	@IsUUID()
	@IsNotEmpty()
	markdown_content_id: string;

	@ApiProperty({ description: 'Resolved markdown content as text' })
	@IsString()
	@IsNotEmpty()
	markdown_content: string;

	@ApiProperty({ required: false })
	@IsString()
	@IsOptional()
	video_id?: string | undefined;

	@ApiProperty()
	@IsDateString()
	@IsNotEmpty()
	created_at: Date;
}

export class PostResponseDto extends BasePostDto {}
