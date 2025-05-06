import { OmitType } from '@nestjs/swagger';
import { BaseJournalRecordDto } from './base-journal-record.dto';

export class CreateJournalRecordDto extends OmitType(BaseJournalRecordDto, [
	'id',
	'markdown_content_id',
	'created_at',
]) {}
