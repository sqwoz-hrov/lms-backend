import { isDueNow } from '../utils/is-due-now';
import {
	BillingAttemptContext,
	BillingPersistencePort,
	BillingPaymentRecord,
	PreparedBillingAttempt,
} from '../ports/billing-persistence';
import { BillableSubscriptionRow } from '../subscription.repository';
import { Subscription } from '../subscription.entity';

type RecordedEvent =
	| { type: 'billing.attempt'; subscriptionId: string; attemptId: string }
	| { type: 'billing.success'; subscriptionId: string; attemptId: string; paymentId: string }
	| { type: 'billing.failure'; subscriptionId: string; attemptId: string; error: string };

export class InMemoryBillingPersistence implements BillingPersistencePort {
	private readonly subscriptions = new Map<string, Subscription>();
	private readonly queue: BillableSubscriptionRow[] = [];
	private readonly retryWindowDays: number;

	public readonly recordedEvents: RecordedEvent[] = [];
	public fetchCalls = 0;

	constructor(params: { retryWindowDays: number }) {
		this.retryWindowDays = params.retryWindowDays;
	}

	addCandidate(candidate: BillableSubscriptionRow): void {
		this.queue.push({ ...candidate });
		const { billing_payment_method_id: _, ...subscription } = candidate;
		this.subscriptions.set(candidate.user_id, structuredCloneSubscription(subscription));
	}

	fetchBillableSubscriptions(params: { runDate: Date; limit: number }): Promise<BillableSubscriptionRow[]> {
		this.fetchCalls += 1;
		if (this.queue.length === 0) {
			return Promise.resolve([]);
		}

		return Promise.resolve(this.queue.splice(0, params.limit).map(candidate => ({ ...candidate })));
	}

	prepareAttempt(candidate: BillableSubscriptionRow, context: BillingAttemptContext): Promise<PreparedBillingAttempt> {
		const subscription = this.subscriptions.get(candidate.user_id);
		if (!subscription) {
			return Promise.resolve({ status: 'skip', reason: 'subscription-missing' });
		}

		if (!isDueNow(subscription, context.runDate, this.retryWindowDays)) {
			return Promise.resolve({ status: 'skip', reason: 'not-due' });
		}

		subscription.last_billing_attempt = new Date(context.attemptTime);
		this.recordedEvents.push({
			type: 'billing.attempt',
			subscriptionId: subscription.id,
			attemptId: context.attemptId,
		});

		return Promise.resolve({ status: 'ready', subscription: structuredCloneSubscription(subscription) });
	}

	recordSuccess(params: {
		subscription: Subscription;
		context: BillingAttemptContext;
		payment: BillingPaymentRecord;
	}): Promise<void> {
		this.recordedEvents.push({
			type: 'billing.success',
			subscriptionId: params.subscription.id,
			attemptId: params.context.attemptId,
			paymentId: params.payment.id,
		});
		return Promise.resolve();
	}

	recordFailure(params: { subscription: Subscription; context: BillingAttemptContext; error: string }): Promise<void> {
		this.recordedEvents.push({
			type: 'billing.failure',
			subscriptionId: params.subscription.id,
			attemptId: params.context.attemptId,
			error: params.error,
		});
		return Promise.resolve();
	}
}

const structuredCloneSubscription = (subscription: Subscription): Subscription => ({
	...subscription,
	created_at: new Date(subscription.created_at),
	updated_at: new Date(subscription.updated_at),
	current_period_end: subscription.current_period_end ? new Date(subscription.current_period_end) : null,
	last_billing_attempt: subscription.last_billing_attempt ? new Date(subscription.last_billing_attempt) : null,
});
