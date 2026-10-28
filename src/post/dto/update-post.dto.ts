import { ApiPropertyOptional, IntersectionType, OmitType, PartialType, PickType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { BasePostDto } from './base-post.dto';

export class UpdatePostDto extends IntersectionType(
	PickType(BasePostDto, ['id'] as const),
	PartialType(OmitType(BasePostDto, ['id', 'slug', 'markdown_content_id', 'created_at'] as const)),
) {
	@ApiPropertyOptional({ description: 'Generate a permanent slug when the post does not have one yet' })
	@IsBoolean()
	@IsOptional()
	generate_slug?: boolean;
}
