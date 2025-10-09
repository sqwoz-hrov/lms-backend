import { ApiProperty, OmitType } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsNotEmpty, IsString } from 'class-validator';
import { BaseTaskDto } from './base-task.dto';

export class CreateTaskForMultipleUsersDto extends OmitType(BaseTaskDto, [
	'id',
	'markdown_content_id',
	'created_at',
	'student_user_id',
]) {
	@ApiProperty({ type: [String] })
	@IsArray()
	@ArrayNotEmpty()
	@IsString({ each: true })
	@IsNotEmpty({ each: true })
	student_user_ids: string[];
}
