import { PickType } from '@nestjs/swagger';
import { BaseJournalRecordDto } from './base-journal-record.dto';

export class DeleteJournalRecordDto extends PickType(BaseJournalRecordDto, ['id']) {}
