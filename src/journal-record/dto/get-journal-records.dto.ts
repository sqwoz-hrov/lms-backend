import { IsOptional, IsUUID, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class GetJournalRecordsDto {
	@ApiPropertyOptional()
	@IsOptional()
	@IsUUID()
	student_user_id?: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsUUID()
	markdown_content_id?: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	name?: string;
}
