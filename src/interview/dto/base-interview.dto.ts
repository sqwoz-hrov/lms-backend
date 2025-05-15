import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsString, IsEnum, IsDate } from 'class-validator';
import { InterviewType } from '../interview.entity';

export class BaseInterviewDto {
	@ApiProperty()
	@IsUUID()
	id: string;

	@ApiProperty()
	@IsUUID()
	hr_connection_id: string;

	@ApiProperty()
	@IsString()
	name: string;

	@ApiProperty({ enum: ['screening', 'technical_interview', 'final', 'other'] })
	@IsEnum(['screening', 'technical_interview', 'final', 'other'])
	type: InterviewType;

	@ApiProperty()
	@IsDate()
	created_at: Date;
}

export class InterviewResponseDto extends BaseInterviewDto {}
