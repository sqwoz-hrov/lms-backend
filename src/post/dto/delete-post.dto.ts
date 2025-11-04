import { PickType } from '@nestjs/swagger';
import { BasePostDto } from './base-post.dto';

export class DeletePostDto extends PickType(BasePostDto, ['id'] as const) {}
