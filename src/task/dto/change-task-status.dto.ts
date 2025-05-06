import { PickType } from '@nestjs/swagger';
import { BaseTaskDto } from './base-task.dto';

export class ChangeTaskStatusDto extends PickType(BaseTaskDto, ['id', 'status']) {}
