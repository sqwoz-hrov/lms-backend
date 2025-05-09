import { OmitType } from '@nestjs/swagger';
import { BaseTaskDto } from './base-task.dto';

export class CreateTaskDto extends OmitType(BaseTaskDto, ['id', 'markdown_content_id', 'created_at']) {}
