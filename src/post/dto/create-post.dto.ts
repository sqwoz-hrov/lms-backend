import { ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { BasePostDto } from './base-post.dto';

export class CreatePostDto extends OmitType(BasePostDto, ['id', 'slug', 'markdown_content_id', 'created_at'] as const) {
	@ApiPropertyOptional({ description: 'Generate a permanent slug from the title' })
	@IsBoolean()
	@IsOptional()
	generate_slug?: boolean;
}
