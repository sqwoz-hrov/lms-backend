import { BillingEventType } from '../constants';
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
	| { type: BillingEventType.ATTEMPT_PREPARED; subscriptionId: string; attemptId: string }
	| { type: BillingEventType.CHARGE_REQUESTED; subscriptionId: string; attemptId: string; paymentId: string }
	| { type: BillingEventType.CHARGE_REQUEST_FAILED; subscriptionId: string; attemptId: string; error: string };

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

	// eslint-disable-next-line @typescript-eslint/require-await
	async *fetchBillableSubscriptions(params: {
		runDate: Date;
		limit: number;
		signal?: AbortSignal;
	}): AsyncGenerator<BillableSubscriptionRow> {
		this.fetchCalls += 1;

		while (this.queue.length > 0 && !params.signal?.aborted) {
			const batch = this.queue.splice(0, params.limit);
			for (const candidate of batch) {
				if (params.signal?.aborted) {
					return;
				}

				yield { ...candidate };
			}
		}
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
			type: BillingEventType.ATTEMPT_PREPARED,
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
			type: BillingEventType.CHARGE_REQUESTED,
			subscriptionId: params.subscription.id,
			attemptId: params.context.attemptId,
			paymentId: params.payment.id,
		});
		return Promise.resolve();
	}

	recordFailure(params: { subscription: Subscription; context: BillingAttemptContext; error: string }): Promise<void> {
		this.recordedEvents.push({
			type: BillingEventType.CHARGE_REQUEST_FAILED,
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
