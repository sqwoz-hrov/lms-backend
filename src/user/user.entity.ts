import { ColumnType, Insertable, Selectable, Updateable } from 'kysely';
import { Subscription, SubscriptionTable } from '../subscription/subscription.entity';
import { Generated } from '../common/kysely-types/generated';
import { SubscriptionTier, SubscriptionTierTable } from '../subscription-tier/subscription-tier.entity';
import { GiftTable } from '../gift/gift.entity';

export type UserRole = 'admin' | 'user' | 'subscriber';

export const COLOR_THEMES = ['dark', 'light'] as const;
export type ColorTheme = (typeof COLOR_THEMES)[number];

export const HOMEPAGE_OPTIONS = ['posts', 'home', 'transcriptions'] as const;
export type HomepagePreference = (typeof HOMEPAGE_OPTIONS)[number];

export const DEFAULT_USER_SETTINGS: UserSettings = {
	theme: 'light',
	homepage: 'home',
};

export interface UserSettings {
	theme: ColorTheme;
	homepage: HomepagePreference;
}

export interface UserTable {
	id: Generated<string>;
	role: UserRole;
	name: string;
	email: string;
	telegram_id?: number;
	telegram_username: string;
	finished_registration: ColumnType<boolean, boolean | undefined>;
	is_archived: ColumnType<boolean, boolean | undefined>;
	settings: ColumnType<UserSettings, UserSettings | undefined, UserSettings | undefined>;
}

export type User = Selectable<UserTable>;
export type NewUser = Insertable<UserTable>;
export type UserUpdate = Updateable<UserTable>;

export interface UserAggregation {
	user: UserTable;
	subscription: SubscriptionTable;
	gift: GiftTable;
	subscription_tier: SubscriptionTierTable;
}

export type UserAndSubscriptionEntity = Pick<UserAggregation, 'subscription' | 'subscription_tier' | 'user'>;

export type SubscriptionGift = {
	is_gifted: boolean;
}

export type UserWithNullableSubscriptionTier = (User & { role: 'admin' | 'user' } & {
	subscription?: (Subscription & SubscriptionGift) | null;
	subscription_tier?: SubscriptionTier | null;
}) | (User & { role: 'subscriber' } & {
	subscription: Subscription & SubscriptionGift;
	subscription_tier: SubscriptionTier;
});

export type UserWithSubscriptionTier = User & {
	subscription: Subscription & SubscriptionGift;
	subscription_tier: SubscriptionTier;
};

export const DELETED_USER_FIELD_FALLBACK = 'USER_DELETED' as const;