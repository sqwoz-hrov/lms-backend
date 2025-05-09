import { Generated, Insertable, Selectable, Updateable } from 'kysely';

export interface SubjectTable {
	id: Generated<string>;
	name: string;
	color_code: string;
}

export type Subject = Selectable<SubjectTable>;
export type NewSubject = Insertable<SubjectTable>;
export type SubjectUpdate = Updateable<SubjectTable>;

export interface SubjectAggregation {
	subject: SubjectTable;
}
