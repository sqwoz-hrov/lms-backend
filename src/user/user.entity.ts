import { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely';
import { Subscription, SubscriptionTable } from '../subscription/subscription.entity';

export type UserRole = 'admin' | 'user' | 'subscriber';

export interface SubscriptionTierTable {
	id: Generated<string>;
	tier: string;
	power: ColumnType<number, number | undefined, number | undefined>;
	permissions: ColumnType<string[], string[] | undefined, string[] | undefined>;
}

export type SubscriptionTier = Selectable<SubscriptionTierTable>;
export type NewSubscriptionTier = Insertable<SubscriptionTierTable>;
export type SubscriptionTierUpdate = Updateable<SubscriptionTierTable>;

export interface UserTable {
	id: Generated<string>;
	role: UserRole;
	name: string;
	email: string;
	telegram_id?: number;
	telegram_username: string;
	finished_registration: ColumnType<boolean, boolean | undefined>;
	is_archived: ColumnType<boolean, boolean | undefined>;
}

export type User = Selectable<UserTable>;
export type NewUser = Insertable<UserTable>;
export type UserUpdate = Updateable<UserTable>;

export interface UserAggregation {
	user: UserTable;
	subscription: SubscriptionTable;
	subscription_tier: SubscriptionTierTable;
}

export type UserWithSubscriptionTier = User & {
	subscription?: Subscription | null;
	subscription_tier?: SubscriptionTier | null;
};
