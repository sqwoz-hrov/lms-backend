import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class RestartInterviewTranscriptionDto {
	@ApiProperty()
	@IsUUID()
	interview_transcription_id: string;
}
