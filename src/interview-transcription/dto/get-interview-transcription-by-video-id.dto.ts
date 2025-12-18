import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class GetInterviewTranscriptionByVideoIdDto {
	@ApiProperty()
	@IsUUID()
	video_id: string;
}
