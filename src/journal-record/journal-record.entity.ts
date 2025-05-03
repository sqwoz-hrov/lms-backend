import { Generated, Insertable, Selectable, Updateable } from 'kysely';

export interface JournalRecordTable {
	id: Generated<string>;
	student_user_id: string;
	name: string;
	created_at: Generated<Date>;
	markdown_content_id: string;
}

export type JournalRecord = Selectable<JournalRecordTable>;
export type NewJournalRecord = Insertable<JournalRecordTable>;
export type JournalRecordUpdate = Updateable<JournalRecordTable>;

export interface JournalRecordAggregation {
	journal_record: JournalRecordTable;
}
