import { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely';

export const STATUS_VALUES = ['created', 'processing', 'done'] as const;

export type InterviewTranscriptionStatus = (typeof STATUS_VALUES)[number];

export interface InterviewTranscriptionTable {
	id: Generated<string>;
	video_id: string;
	status: InterviewTranscriptionStatus;
	s3_transcription_key: string | null;
	created_at: ColumnType<Date, string | undefined, never>;
	updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export type InterviewTranscription = Selectable<InterviewTranscriptionTable>;
export type NewInterviewTranscription = Insertable<InterviewTranscriptionTable>;
export type InterviewTranscriptionUpdate = Updateable<InterviewTranscriptionTable>;

export interface InterviewTranscriptionAggregation {
	interview_transcription: InterviewTranscriptionTable;
}
