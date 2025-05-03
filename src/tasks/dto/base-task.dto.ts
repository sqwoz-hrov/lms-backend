import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsNotEmpty, IsNumber, IsString } from 'class-validator';
import { TaskStatus } from '../task.entity';

const TaskStatuses: TaskStatus[] = ['backlog', 'todo', 'in_progress', 'in_review', 'done'];

export class BaseTaskDto {
	@ApiProperty()
	@IsString()
	@IsNotEmpty()
	id: string;

	@ApiProperty()
	@IsString()
	@IsNotEmpty()
	student_user_id: string;

	@ApiProperty()
	@IsString()
	@IsNotEmpty()
	mentor_user_id: string;

	@ApiProperty()
	@IsString()
	@IsNotEmpty()
	summary: string;

	@ApiProperty()
	@IsString()
	@IsNotEmpty()
	markdown_content_id: string;

	@ApiProperty()
	@IsString()
	@IsNotEmpty()
	markdown_content: string;

	@ApiProperty()
	@IsDateString()
	@IsNotEmpty()
	deadline: Date;

	@ApiProperty()
	@IsDateString()
	@IsNotEmpty()
	created_at: Date;

	@ApiProperty()
	@IsNumber()
	@IsNotEmpty()
	priority: number;

	@ApiProperty({ enum: TaskStatuses })
	@IsEnum(TaskStatuses)
	@IsNotEmpty()
	status: TaskStatus;
}

export class TaskResponseDto extends BaseTaskDto {}
