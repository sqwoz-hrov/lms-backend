import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class GetInterviewTranscriptionDto {
	@ApiProperty()
	@IsUUID()
	video_id: string;
}
