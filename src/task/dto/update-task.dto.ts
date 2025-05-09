import { IntersectionType, PartialType, PickType } from '@nestjs/swagger';
import { BaseTaskDto } from './base-task.dto';

export class UpdateTaskDto extends IntersectionType(PartialType(BaseTaskDto), PickType(BaseTaskDto, ['id'])) {}
