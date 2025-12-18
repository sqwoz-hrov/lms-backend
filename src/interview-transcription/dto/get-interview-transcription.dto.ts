import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class GetInterviewTranscriptionDto {
	@ApiProperty()
	@IsUUID()
	transcription_id: string;
}
