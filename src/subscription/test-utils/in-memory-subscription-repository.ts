import { BillingEventType } from '../constants';
import { NewPaymentEvent, Subscription, SubscriptionUpdate } from '../subscription.entity';
import type { BillableSubscriptionRow } from '../subscription.repository';
import {
	BillableSubscriptionCursor,
	SubscriptionRepositoryPort,
	SubscriptionRepositoryPortTransaction,
} from '../ports/subscription-repository.port';

type RecordedEvent =
	| { type: BillingEventType.ATTEMPT_PREPARED; event: Record<string, unknown> }
	| { type: BillingEventType.CHARGE_REQUESTED; event: Record<string, unknown> }
	| { type: BillingEventType.CHARGE_REQUEST_FAILED; event: Record<string, unknown> };

export class InMemorySubscriptionRepository implements SubscriptionRepositoryPort {
	private readonly subscriptions = new Map<string, Subscription>();
	private queue: BillableSubscriptionRow[] = [];

	public readonly recordedEvents: RecordedEvent[] = [];
	public fetchCalls = 0;

	addCandidate(candidate: BillableSubscriptionRow): void {
		this.queue.push(structuredCloneCandidate(candidate));
		const { billing_payment_method_id: _ignored, ...subscription } = candidate;
		this.subscriptions.set(candidate.user_id, structuredCloneSubscription(subscription));
	}

	removeSubscriptionByUserId(userId: string): void {
		this.subscriptions.delete(userId);
	}

	findBillableSubscriptions(params: {
		runDate: Date;
		retryWindowDays: number;
		limit: number;
		cursor?: BillableSubscriptionCursor;
	}): Promise<BillableSubscriptionRow[]> {
		this.fetchCalls += 1;
		const sorted = [...this.queue].sort(compareCandidates);
		const filtered = params.cursor ? sorted.filter(candidate => isAfterCursor(candidate, params.cursor!)) : sorted;

		const batch = filtered.slice(0, params.limit);
		this.queue = this.queue.filter(candidate => !batch.some(selected => selected.id === candidate.id));

		return Promise.resolve(batch.map(structuredCloneCandidate));
	}

	async transaction<T>(handler: (trx: SubscriptionRepositoryPortTransaction) => Promise<T>): Promise<T> {
		return handler({} as SubscriptionRepositoryPortTransaction);
	}

	async lockByUserId(userId: string, _trx: SubscriptionRepositoryPortTransaction): Promise<Subscription | undefined> {
		const subscription = this.subscriptions.get(userId);
		return Promise.resolve(subscription ? structuredCloneSubscription(subscription) : undefined);
	}

	update(
		id: string,
		data: SubscriptionUpdate,
		_trx?: SubscriptionRepositoryPortTransaction,
	): Promise<Subscription | undefined> {
		for (const [userId, subscription] of this.subscriptions.entries()) {
			if (subscription.id !== id) {
				continue;
			}

			const next: Subscription = {
				...subscription,
				...pickUpdatableFields(data),
			};

			this.subscriptions.set(userId, next);
			return Promise.resolve(structuredCloneSubscription(next));
		}

		return Promise.resolve(undefined);
	}

	insertPaymentEvent(data: NewPaymentEvent, _trx?: SubscriptionRepositoryPortTransaction): Promise<void> {
		const eventPayload = { ...(data.event as Record<string, unknown>) };
		const record: RecordedEvent = {
			type: eventPayload.type as BillingEventType,
			event: eventPayload,
		} as RecordedEvent;
		this.recordedEvents.push(record);
		return Promise.resolve();
	}
}

const structuredCloneCandidate = (candidate: BillableSubscriptionRow): BillableSubscriptionRow => ({
	...candidate,
	created_at: new Date(candidate.created_at),
	updated_at: new Date(candidate.updated_at),
	current_period_end: candidate.current_period_end ? new Date(candidate.current_period_end) : null,
	last_billing_attempt: candidate.last_billing_attempt ? new Date(candidate.last_billing_attempt) : null,
});

const structuredCloneSubscription = (subscription: Subscription): Subscription => ({
	...subscription,
	created_at: new Date(subscription.created_at),
	updated_at: new Date(subscription.updated_at),
	current_period_end: subscription.current_period_end ? new Date(subscription.current_period_end) : null,
	last_billing_attempt: subscription.last_billing_attempt ? new Date(subscription.last_billing_attempt) : null,
});

const pickUpdatableFields = (update: SubscriptionUpdate): Partial<Subscription> => {
	const result: Partial<Subscription> = {};

	if ('current_period_end' in update && update.current_period_end !== undefined) {
		result.current_period_end = update.current_period_end === null ? null : new Date(update.current_period_end);
	}

	if ('last_billing_attempt' in update && update.last_billing_attempt !== undefined) {
		result.last_billing_attempt = update.last_billing_attempt === null ? null : new Date(update.last_billing_attempt);
	}

	if ('updated_at' in update && update.updated_at !== undefined) {
		result.updated_at = new Date(update.updated_at as Date);
	} else {
		result.updated_at = new Date();
	}

	return result;
};

const compareCandidates = (a: BillableSubscriptionRow, b: BillableSubscriptionRow): number => {
	const periodA = getDueTime(a);
	const periodB = getDueTime(b);

	if (periodA !== periodB) {
		return periodA - periodB;
	}

	return a.id.localeCompare(b.id);
};

const isAfterCursor = (candidate: BillableSubscriptionRow, cursor: BillableSubscriptionCursor): boolean => {
	const candidateDue = getDueTime(candidate);
	const cursorDue = cursor.currentPeriodEnd ? cursor.currentPeriodEnd.getTime() : Number.NEGATIVE_INFINITY;

	if (candidateDue > cursorDue) {
		return true;
	}

	if (candidateDue < cursorDue) {
		return false;
	}

	return candidate.id.localeCompare(cursor.id) > 0;
};

const getDueTime = (candidate: BillableSubscriptionRow): number =>
	candidate.current_period_end ? candidate.current_period_end.getTime() : Number.NEGATIVE_INFINITY;
