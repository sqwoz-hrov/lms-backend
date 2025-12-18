import { Insertable, Selectable, Updateable } from 'kysely';
import { VideoTable } from '../video/video.entity';
import { Timestamp } from '../common/kysely-types/timestamp';
import { Generated } from '../common/kysely-types/generated';

export const STATUS_VALUES = ['created', 'processing', 'done'] as const;

export type InterviewTranscriptionStatus = (typeof STATUS_VALUES)[number];

export interface InterviewTranscriptionTable {
	id: Generated<string>;
	video_id: string;
	status: InterviewTranscriptionStatus;
	s3_transcription_key: string | null;
	created_at: Generated<Timestamp>;
	updated_at: Generated<Timestamp>;
}

export type InterviewTranscription = Selectable<InterviewTranscriptionTable>;
export type NewInterviewTranscription = Insertable<InterviewTranscriptionTable>;
export type InterviewTranscriptionUpdate = Updateable<InterviewTranscriptionTable>;

export interface InterviewTranscriptionAggregation {
	interview_transcription: InterviewTranscriptionTable;
	video: VideoTable;
}
