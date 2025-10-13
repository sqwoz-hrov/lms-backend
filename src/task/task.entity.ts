import { Generated, Insertable, Selectable, Updateable } from 'kysely';

export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done';

export interface TaskTable {
	id: Generated<string>;
	student_user_id: string;
	mentor_user_id: string;
	summary: string;
	markdown_content_id: string;
	deadline: Date;
	created_at: Generated<Date>;
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
