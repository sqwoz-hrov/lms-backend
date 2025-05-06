import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, IsDate } from 'class-validator';

export class BaseJournalRecordDto {
	@ApiProperty()
	@IsUUID()
	id: string;

	@ApiProperty()
	@IsUUID()
	student_user_id: string;

	@ApiProperty()
	@IsString()
	name: string;

	@ApiProperty()
	@IsDate()
	created_at: Date;

	@ApiProperty()
	@IsUUID()
	markdown_content_id: string;

	@ApiProperty({ description: 'Resolved markdown content as text' })
	@IsString()
	markdown_content: string;
}
