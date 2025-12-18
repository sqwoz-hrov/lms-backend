import { Insertable, Selectable, Updateable } from 'kysely';
import { Generated } from '../common/kysely-types/generated';

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

export type FeedbackWithContent = Feedback & {
	markdown_content: string;
};
