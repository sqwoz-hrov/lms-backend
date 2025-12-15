import { Insertable, Selectable, Updateable } from 'kysely';
import { Generated } from '../common/kysely-types/generated';
import { Timestamp } from '../common/kysely-types/timestamp';

export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done';

export interface TaskTable {
	id: Generated<string>;
	student_user_id: string;
	mentor_user_id: string;
	summary: string;
	markdown_content_id: string;
	deadline: Timestamp;
	created_at: Generated<Timestamp>;
	priority: number;
	status: TaskStatus;
}

export type Task = Selectable<TaskTable>;
export type NewTask = Insertable<TaskTable>;
export type TaskUpdate = Updateable<TaskTable>;

export interface TaskAggregation {
	task: TaskTable;
}

export type TaskWithMarkdown = Task & {
	markdown_content: string;
};
