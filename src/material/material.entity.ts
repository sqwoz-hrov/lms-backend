import { Insertable, Selectable, Updateable } from 'kysely';
import { Generated } from '../common/kysely-types/generated';
import { Nullable } from '../common/kysely-types/nullable';

export interface MaterialTable {
	id: Generated<string>;
	student_user_id: Nullable<string>;
	subject_id: string;
	name: string;
	video_id: Nullable<string>;
	markdown_content_id: Nullable<string>;
	is_archived: Generated<boolean>;
}

export type Material = Selectable<MaterialTable>;
export type NewMaterial = Insertable<MaterialTable>;
export type MaterialUpdate = Updateable<MaterialTable>;

export interface MaterialTierTable {
	tier_id: string;
	material_id: string;
}

export type MaterialTier = Selectable<MaterialTierTable>;
export type NewMaterialTier = Insertable<MaterialTierTable>;

export interface MaterialAggregation {
	material: MaterialTable;
	material_tier: MaterialTierTable;
}

export type MaterialWithContent = Material & {
	markdown_content?: string;
	subscription_tier_ids?: string[];
};
