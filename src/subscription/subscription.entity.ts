import { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely';

export type SubscriptionStatus = 'pending' | 'active' | 'past_due' | 'canceled';

export interface SubscriptionTable {
	id: Generated<string>;
	user_id: string;
	subscription_tier_id: string;
	status: ColumnType<SubscriptionStatus, SubscriptionStatus | undefined>;
	price_on_purchase_rubles: number;
	is_gifted: ColumnType<boolean, boolean | undefined>;
	grace_period_size: ColumnType<number, number | undefined>;
	billing_period_days: number;
	payment_method_id: ColumnType<string | null, string | null | undefined>;
	current_period_end: ColumnType<Date, Date | string>;
	next_billing_at: ColumnType<Date | null, Date | string | null | undefined>;
	billing_retry_attempts: ColumnType<number, number | undefined>;
	last_billing_attempt: ColumnType<Date | null, Date | string | null | undefined>;
	created_at: Generated<Date>;
	updated_at: ColumnType<Date, Date | string | undefined, Date | string | undefined>;
}

export type Subscription = Selectable<SubscriptionTable>;
export type NewSubscription = Insertable<SubscriptionTable>;
export type SubscriptionUpdate = Updateable<SubscriptionTable>;
export type SubscriptionState = Omit<Subscription, 'created_at' | 'updated_at'>;
export type SubscriptionDraft = Omit<SubscriptionState, 'id'> & Partial<Pick<SubscriptionState, 'id'>>;

export interface SubscriptionAggregation {
	subscription: SubscriptionTable;
}

export interface PaymentEventTable {
	id: Generated<string>;
	user_id: string;
	subscription_id: ColumnType<string | null, string | null | undefined>;
	event: ColumnType<unknown, unknown>;
	created_at: Generated<Date>;
}

export type PaymentEvent = Selectable<PaymentEventTable>;
export type NewPaymentEvent = Insertable<PaymentEventTable>;
