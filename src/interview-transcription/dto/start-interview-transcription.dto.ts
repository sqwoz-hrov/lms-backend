import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class StartInterviewTranscriptionDto {
	@ApiProperty()
	@IsUUID()
	video_id: string;
}
