import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsString } from 'class-validator';

export class BaseFeedbackDto {
	@ApiProperty()
	@IsUUID()
	id: string;

	@ApiProperty()
	@IsUUID()
	interview_id: string;

	@ApiProperty()
	@IsUUID()
	markdown_content_id: string;

	@ApiProperty({ description: 'Resolved markdown content as text' })
	@IsString()
	markdown_content: string;
}

export class FeedbackResponseDto extends BaseFeedbackDto {}
