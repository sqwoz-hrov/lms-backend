import { OmitType } from '@nestjs/swagger';
import { BasePostDto } from './base-post.dto';

export class CreatePostDto extends OmitType(BasePostDto, ['id', 'markdown_content_id', 'created_at'] as const) {}
