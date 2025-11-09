import { Subscription } from '../subscription.entity';
import { BillableSubscriptionRow } from '../subscription.repository';

export interface BillingAttemptContext {
	attemptId: string;
	attemptTime: Date;
	runDate: Date;
	paymentMethodId: string;
}

export interface BillingPaymentRecord {
	id: string;
	created_at: string;
}

export type PreparedBillingAttempt =
	| { status: 'ready'; subscription: Subscription }
	| { status: 'skip'; reason: 'subscription-missing' | 'not-due' };

export interface BillingPersistencePort {
	fetchBillableSubscriptions(params: { runDate: Date; limit: number }): Promise<BillableSubscriptionRow[]>;
	prepareAttempt(candidate: BillableSubscriptionRow, context: BillingAttemptContext): Promise<PreparedBillingAttempt>;
	recordSuccess(params: {
		subscription: Subscription;
		context: BillingAttemptContext;
		payment: BillingPaymentRecord;
	}): Promise<void>;
	recordFailure(params: { subscription: Subscription; context: BillingAttemptContext; error: string }): Promise<void>;
}
