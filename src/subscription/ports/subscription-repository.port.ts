import type { NewPaymentEvent, Subscription, SubscriptionUpdate } from '../subscription.entity';
import type { BillableSubscriptionRow } from '../subscription.repository';

export type SubscriptionRepositoryPortTransaction = unknown;

export type BillableSubscriptionCursor = {
	id: Subscription['id'];
	currentPeriodEnd: Subscription['current_period_end'];
};

export interface SubscriptionRepositoryPort<Transaction = SubscriptionRepositoryPortTransaction> {
	findBillableSubscriptions(params: {
		runDate: Date;
		retryWindowDays: number;
		limit: number;
		cursor?: BillableSubscriptionCursor;
	}): Promise<BillableSubscriptionRow[]>;
	transaction<T>(handler: (trx: Transaction) => Promise<T>): Promise<T>;
	lockByUserId(userId: Subscription['user_id'], trx: Transaction): Promise<Subscription | undefined>;
	update(id: Subscription['id'], data: SubscriptionUpdate, trx?: Transaction): Promise<Subscription | undefined>;
	insertPaymentEvent(data: NewPaymentEvent, trx?: Transaction): Promise<void>;
}
