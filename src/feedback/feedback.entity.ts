import { Generated, Insertable, Selectable, Updateable } from 'kysely';

export interface FeedbackTable {
	id: Generated<string>;
	interview_id: string;
	markdown_content_id: string;
}

export type Feedback = Selectable<FeedbackTable>;
export type NewFeedback = Insertable<FeedbackTable>;
export type FeedbackUpdate = Updateable<FeedbackTable>;

export interface FeedbackAggregation {
	feedback: FeedbackTable;
}
