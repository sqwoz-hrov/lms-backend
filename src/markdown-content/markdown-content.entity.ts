import { Insertable, Selectable, Updateable } from 'kysely';
import { Generated } from '../common/kysely-types/generated';

export interface MarkDownContentTable {
	id: Generated<string>;
	content_text: string;
}

export type MarkDownContent = Selectable<MarkDownContentTable>;
export type NewMarkDownContent = Insertable<MarkDownContentTable>;
export type MarkDownContentUpdate = Updateable<MarkDownContentTable>;

export interface MarkDownContentAggregation {
	markdown_content: MarkDownContentTable;
}
