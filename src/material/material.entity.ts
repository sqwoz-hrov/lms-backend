import { Generated, Insertable, Selectable, Updateable } from 'kysely';

export type MaterialType = 'article' | 'video' | 'other';

export interface MaterialTable {
	id: Generated<string>;
	student_user_id: string | undefined;
	subject_id: string;
	name: string;
	type: MaterialType;
	video_id: string | undefined;
	markdown_content_id: string | undefined;
	is_archived: Generated<boolean>;
}

export type Material = Selectable<MaterialTable>;
export type NewMaterial = Insertable<MaterialTable>;
export type MaterialUpdate = Updateable<MaterialTable>;

export interface MaterialAggregation {
	material: MaterialTable;
}
