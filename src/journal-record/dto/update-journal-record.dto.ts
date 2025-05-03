import { PartialType, OmitType, PickType, IntersectionType } from '@nestjs/swagger';
import { BaseJournalRecordDto } from './base-journal-record.dto';

export class UpdateJournalRecordDto extends IntersectionType(
	PickType(BaseJournalRecordDto, ['id']),
	PartialType(OmitType(BaseJournalRecordDto, ['id', 'markdown_content_id', 'created_at'])),
) {}
