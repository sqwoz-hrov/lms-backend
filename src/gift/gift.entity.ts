import { ColumnType, Insertable, Selectable, Updateable } from 'kysely';
import { Generated } from '../common/kysely-types/generated';
import { Timestamp } from '../common/kysely-types/timestamp';
import { UserTable } from '../user/user.entity';
import { SubscriptionTier, SubscriptionTierTable } from '../subscription-tier/subscription-tier.entity';
import { PrefixedValuesRequired } from '../common/kysely-types/prefixed-values';
import { SubscriptionTable } from '../subscription/subscription.entity';

export interface GiftTable {
	id: Generated<string>;
	gifted_to: ColumnType<string, string, never>;
	gifted_by: ColumnType<string, string, never>;
	tier_id: ColumnType<string, string, never>;
	activated_at: Timestamp | null;
	duration_days: number;
}

export type Gift = Selectable<GiftTable>;
export type GiftState = Omit<Gift, 'id' | 'gifted_to' | 'gifted_by' | 'tier_id'>;
export type NewGift = Insertable<GiftTable>;
export type GiftUpdate = Updateable<GiftTable>;

export interface GiftAggregation {
	gift: GiftTable;
	user: UserTable;
	subscription_tier: SubscriptionTierTable;
	subscription: SubscriptionTable;
}

export type GiftWithUser = Gift & Pick<UserTable, 'telegram_username' | 'email' | 'name'>;
export type GiftWithSubscriptionTier = Gift & {
	tier: Omit<SubscriptionTier, 'is_archived' | 'markdown_description_id'>;
};
export type GiftWithUserAndSubscriptionTier = GiftWithUser & {
	tier: Omit<SubscriptionTier, 'is_archived' | 'markdown_description_id'>;
};
export type GiftStatus = 'currently_active' | 'used' | 'available';
export type GiftWithUserSubscriptionTierAndStatus = GiftWithUserAndSubscriptionTier & {
	expires_at: Date | null;
	gift_status: GiftStatus;
};

export type GiftGroupedByStatus = {
	currentlyActive: GiftWithUserSubscriptionTierAndStatus[];
	used: GiftWithUserSubscriptionTierAndStatus[];
	available: GiftWithUserSubscriptionTierAndStatus[];
};

export type GiftGroupedByStatusPage = GiftGroupedByStatus & {
	pagination: {
		page: number;
		pageSize: number;
		totalItems: number;
		totalPages: number;
		hasNextPage: boolean;
		hasPreviousPage: boolean;
	};
};

export type GiftWithSubscriptionTierAggregated = PrefixedValuesRequired<Gift, 'gift__'> &
	PrefixedValuesRequired<Omit<SubscriptionTier, 'is_archived' | 'markdown_description_id'>, 'tier__'>;
