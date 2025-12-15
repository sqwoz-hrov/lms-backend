import { Insertable, Selectable, Updateable } from 'kysely';
import { Generated } from '../common/kysely-types/generated';

export interface SubjectTable {
	id: Generated<string>;
	name: string;
	color_code: string;
}

export type Subject = Selectable<SubjectTable>;
export type NewSubject = Insertable<SubjectTable>;
export type SubjectUpdate = Updateable<SubjectTable>;

export interface SubjectTierTable {
	tier_id: string;
	subject_id: string;
}

export type SubjectTier = Selectable<SubjectTierTable>;
export type NewSubjectTier = Insertable<SubjectTierTable>;

export interface SubjectAggregation {
	subject: SubjectTable;
	subject_tier: SubjectTierTable;
}

export type SubjectWithSubscriptionTiers = Subject & {
	subscription_tier_ids?: string[];
};
