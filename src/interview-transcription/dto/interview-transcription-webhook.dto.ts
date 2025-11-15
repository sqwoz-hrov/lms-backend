import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class InterviewTranscriptionWebhookDto {
	@ApiProperty()
	@IsUUID()
	interview_transcription_id: string;

	@ApiProperty()
	@IsString()
	@IsNotEmpty()
	s3_transcription_key: string;
}
