import { Insertable, Selectable, Updateable } from 'kysely';
import { Generated } from '../common/kysely-types/generated';
import { Timestamp } from '../common/kysely-types/timestamp';

export interface JournalRecordTable {
	id: Generated<string>;
	student_user_id: string;
	name: string;
	created_at: Generated<Timestamp>;
	markdown_content_id: string;
}

export type JournalRecord = Selectable<JournalRecordTable>;
export type NewJournalRecord = Insertable<JournalRecordTable>;
export type JournalRecordUpdate = Updateable<JournalRecordTable>;

export interface JournalRecordAggregation {
	journal_record: JournalRecordTable;
}

export type JournalRecordWithContent = JournalRecord & {
	markdown_content: string;
};
