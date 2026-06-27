import { ColumnType, Insertable, Selectable, Updateable } from 'kysely';
import { Generated } from '../common/kysely-types/generated';
import { Timestamp } from '../common/kysely-types/timestamp';
import { PaymentMethodTable } from '../payment/payment.entity';
import { GiftTable } from '../gift/gift.entity';
import { SubscriptionTier } from '../subscription-tier/subscription-tier.entity';

export interface SubscriptionTable {
	id: Generated<string>;
	user_id: string;
	current_tier_id: ColumnType<string, string>;
	next_tier_id: ColumnType<string, string>;
	price_on_purchase_rubles: number;
	grace_period_size: ColumnType<number, number | undefined>;
	billing_period_days: number;
	current_period_end: ColumnType<Date | null, Date | string | null | undefined>;
	last_billing_attempt: ColumnType<Date | null, Date | string | null | undefined>;
	created_at: Generated<Timestamp>;
	updated_at: Generated<Timestamp>;
}

export type Subscription = Selectable<SubscriptionTable>;
export type NewSubscription = Insertable<SubscriptionTable>;
export type SubscriptionUpdate = Updateable<SubscriptionTable>;
export type SubscriptionState = Omit<Subscription, 'created_at' | 'updated_at'>;
export type SubscriptionDraft = Omit<SubscriptionState, 'id'> & Partial<Pick<SubscriptionState, 'id'>>;

export interface SubscriptionAggregation {
	gift: GiftTable;
	subscription: SubscriptionTable;
	payment_method: PaymentMethodTable;
}
