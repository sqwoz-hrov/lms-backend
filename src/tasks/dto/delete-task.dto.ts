import { PickType } from '@nestjs/swagger';
import { BaseTaskDto } from './base-task.dto';

export class DeleteTaskDto extends PickType(BaseTaskDto, ['id']) {}
