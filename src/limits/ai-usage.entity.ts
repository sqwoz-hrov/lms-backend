import { Insertable, Selectable } from 'kysely';
import { Generated } from '../common/kysely-types/generated';
import { Timestamp } from '../common/kysely-types/timestamp';
import { LIMITABLE_RESOURCES } from './core/limits.domain';

export const AI_USAGE_FEATURES = LIMITABLE_RESOURCES;
export type AiUsageFeature = (typeof AI_USAGE_FEATURES)[number];

export interface UserAiUsageTable {
	id: Generated<string>;
	user_id: string;
	feature: AiUsageFeature;
	created_at: Generated<Timestamp>;
}

export type UserAiUsage = Selectable<UserAiUsageTable>;
export type NewUserAiUsage = Insertable<UserAiUsageTable>;

export interface UserAiUsageAggregation {
	user_ai_usage: UserAiUsageTable;
}
