import { PartialType, PickType } from '@nestjs/swagger';
import { BaseTaskDto } from './base-task.dto';

export class GetTasksDto extends PartialType(PickType(BaseTaskDto, ['student_user_id', 'mentor_user_id'])) {}
