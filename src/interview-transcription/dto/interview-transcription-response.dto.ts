import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { InterviewTranscriptionStatus, STATUS_VALUES } from '../interview-transcription.entity';

export class InterviewTranscriptionResponseDto {
	@ApiProperty()
	@IsUUID()
	id: string;

	@ApiProperty()
	@IsUUID()
	video_id: string;

	@ApiProperty({ enum: STATUS_VALUES })
	@IsEnum(STATUS_VALUES)
	status: InterviewTranscriptionStatus;

	@ApiPropertyOptional({ nullable: true })
	@IsOptional()
	@IsString()
	s3_transcription_key?: string | null;

	@ApiProperty()
	@IsDate()
	created_at: Date;
}
