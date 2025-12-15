import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class ListInterviewTranscriptionsDto {
	@ApiPropertyOptional({ description: 'Идентификатор пользователя, для которого нужно получить транскрибации' })
	@IsOptional()
	@IsUUID()
	user_id?: string;
}
