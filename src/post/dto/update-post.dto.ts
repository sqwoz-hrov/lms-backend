import { IntersectionType, OmitType, PartialType, PickType } from '@nestjs/swagger';
import { BasePostDto } from './base-post.dto';

export class UpdatePostDto extends IntersectionType(
	PickType(BasePostDto, ['id'] as const),
	PartialType(OmitType(BasePostDto, ['id', 'markdown_content_id', 'created_at'] as const)),
) {}
