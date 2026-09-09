import { ColumnType, Insertable, Selectable, Updateable } from 'kysely';
import { Generated } from '../common/kysely-types/generated';
import { Nullable } from '../common/kysely-types/nullable';

export interface SubscriptionTierTable {
	id: Generated<string>;
	tier: string;
	power: ColumnType<number, number | undefined, number | undefined>;
	permissions: ColumnType<string[], string[] | undefined, string[] | undefined>;
	price_rubles: number;
	is_archived: ColumnType<boolean, boolean | undefined, boolean | undefined>;
	markdown_description_id: Nullable<string>;
}

export type SubscriptionTier = Selectable<SubscriptionTierTable>;
export type NewSubscriptionTier = Insertable<SubscriptionTierTable>;
export type SubscriptionTierUpdate = Updateable<SubscriptionTierTable>;
