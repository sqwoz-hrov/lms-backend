import { Generated, Insertable, Selectable, Updateable } from 'kysely';

export type InterviewType = 'screening' | 'technical_interview' | 'final' | 'other';

export interface InterviewTable {
	id: Generated<string>;
	hr_connection_id: string;
	name: string;
	type: InterviewType;
	video_id: string | undefined;
	created_at: Generated<Date>;
}

export type Interview = Selectable<InterviewTable>;
export type NewInterview = Insertable<InterviewTable>;
export type InterviewUpdate = Updateable<InterviewTable>;

export interface InterviewAggregation {
	interview: InterviewTable;
}
