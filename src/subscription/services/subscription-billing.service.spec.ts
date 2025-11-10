import { expect } from 'chai';
import {
	ChargeSavedPaymentParams,
	YookassaClientPort,
	YookassaPaymentResponse,
} from '../../yookassa/services/yookassa-client.interface';
import { BillableSubscriptionRow } from '../subscription.repository';
import { InMemorySubscriptionRepository } from '../test-utils/in-memory-subscription-repository';
import { SubscriptionBillingService } from './subscription-billing.service';
import { BillingEventType } from '../constants';

const baseConfig = {
	enabled: true,
	dailyTime: '05:00',
	batchSize: 50,
	retryWindowDays: 1,
	description: 'Продление подписки',
};

const createCandidate = (overrides: Partial<BillableSubscriptionRow> = {}): BillableSubscriptionRow => {
	const now = new Date();
	return {
		id: overrides.id ?? 'sub-1',
		user_id: overrides.user_id ?? 'user-1',
		subscription_tier_id: overrides.subscription_tier_id ?? 'tier-1',
		price_on_purchase_rubles: overrides.price_on_purchase_rubles ?? 2500,
		is_gifted: overrides.is_gifted ?? false,
		grace_period_size: overrides.grace_period_size ?? 3,
		billing_period_days: overrides.billing_period_days ?? 30,
		current_period_end: overrides.current_period_end ?? new Date(now.getTime() - 24 * 60 * 60 * 1000),
		last_billing_attempt: overrides.last_billing_attempt ?? null,
		created_at: overrides.created_at ?? now,
		updated_at: overrides.updated_at ?? now,
		billing_payment_method_id: overrides.billing_payment_method_id ?? 'pm-1',
	};
};

describe('SubscriptionBillingService', () => {
	it('skips execution when billing disabled', async () => {
		const repository = new InMemorySubscriptionRepository();
		const service = new SubscriptionBillingService(repository, new FakeYookassaClient(), {
			...baseConfig,
			enabled: false,
		});

		const summary = await service.runBillingCycle();

		expect(summary).to.deep.equal({ processed: 0, charged: 0, skipped: 0, failed: 0 });
		expect(repository.fetchCalls).to.equal(0);
	});

	it('skips billing when persistence cannot load the subscription', async () => {
		const repository = new InMemorySubscriptionRepository();
		const service = new SubscriptionBillingService(repository, new FakeYookassaClient(), baseConfig);

		const candidate = createCandidate({ user_id: 'user-missing' });
		repository.addCandidate(candidate);
		repository.removeSubscriptionByUserId(candidate.user_id);

		const summary = await service.runBillingCycle({ now: new Date() });

		expect(summary).to.deep.equal({ processed: 1, charged: 0, skipped: 1, failed: 0 });
		expect(repository.recordedEvents).to.have.length(0);
	});

	it('skips billing when subscription is not due yet', async () => {
		const repository = new InMemorySubscriptionRepository();
		const service = new SubscriptionBillingService(repository, new FakeYookassaClient(), baseConfig);

		const runDate = new Date('2024-05-10T06:00:00Z');
		const candidate = createCandidate({
			user_id: 'user-not-due',
			current_period_end: new Date('2024-05-15T00:00:00Z'),
		});

		repository.addCandidate(candidate);

		const summary = await service.runBillingCycle({ now: runDate });

		expect(summary).to.deep.equal({ processed: 1, charged: 0, skipped: 1, failed: 0 });
		expect(repository.recordedEvents).to.have.length(0);
	});

	it('charges due subscriptions and records success', async () => {
		const repository = new InMemorySubscriptionRepository();
		const yookassa = new FakeYookassaClient({
			nextPayment: createPaymentResponse({ id: 'payment-1' }),
		});

		const service = new SubscriptionBillingService(repository, yookassa, baseConfig);

		const candidate = createCandidate();
		repository.addCandidate(candidate);

		const summary = await service.runBillingCycle({ now: new Date() });

		expect(summary).to.deep.equal({ processed: 1, charged: 1, skipped: 0, failed: 0 });

		expect(yookassa.chargeCalls).to.equal(1);
		const attemptEvents = repository.recordedEvents.filter(event => event.type === BillingEventType.ATTEMPT_PREPARED);
		const successEvents = repository.recordedEvents.filter(event => event.type === BillingEventType.CHARGE_REQUESTED);

		expect(attemptEvents).to.have.length(1);
		expect(successEvents).to.have.length(1);

		const attemptId = attemptEvents[0]?.event.attemptId as string | undefined;
		expect(successEvents[0]?.event.payment_id).to.equal('payment-1');
		expect(successEvents[0]?.event.type).to.equal(BillingEventType.CHARGE_REQUESTED);
		expect(attemptId).to.be.a('string');
		expect(successEvents[0]?.event.attemptId).to.equal(attemptId);
	});

	it('processes all due subscriptions even when total exceeds batch size', async () => {
		const repository = new InMemorySubscriptionRepository();
		const service = new SubscriptionBillingService(repository, new FakeYookassaClient(), {
			...baseConfig,
			batchSize: 2,
		});

		for (let i = 0; i < 5; i += 1) {
			repository.addCandidate(
				createCandidate({
					id: `sub-${i}`,
					user_id: `user-${i}`,
					current_period_end: new Date(`2024-01-0${i + 1}T00:00:00Z`),
					billing_payment_method_id: `pm-${i}`,
				}),
			);
		}

		const summary = await service.runBillingCycle({ now: new Date('2024-02-01T00:00:00Z') });

		expect(summary).to.deep.equal({ processed: 5, charged: 5, skipped: 0, failed: 0 });
		expect(repository.fetchCalls).to.be.greaterThan(1);
	});

	it('does not charge the same subscription twice when queue mutates mid-run', async () => {
		const repository = new InMemorySubscriptionRepository();
		let duplicateScheduled = false;

		const yookassa = new HookedYookassaClient({
			onCharge: params => {
				const userId = params.metadata.user_id;

				if (userId === 'user-1' && !duplicateScheduled) {
					duplicateScheduled = true;

					// Re-queue the already processed subscription with a later period end.
					repository.addCandidate(
						createCandidate({
							id: 'sub-1',
							user_id: 'user-1',
							current_period_end: new Date('2024-01-05T00:00:00Z'),
							billing_payment_method_id: 'pm-1',
						}),
					);

					// Also add a brand new subscription that should still be processed.
					repository.addCandidate(
						createCandidate({
							id: 'sub-3',
							user_id: 'user-3',
							current_period_end: new Date('2024-01-03T00:00:00Z'),
							billing_payment_method_id: 'pm-3',
						}),
					);
				}
			},
		});

		const service = new SubscriptionBillingService(repository, yookassa, {
			...baseConfig,
			batchSize: 1,
		});

		repository.addCandidate(
			createCandidate({
				id: 'sub-1',
				user_id: 'user-1',
				current_period_end: new Date('2024-01-01T00:00:00Z'),
				billing_payment_method_id: 'pm-1',
			}),
		);
		repository.addCandidate(
			createCandidate({
				id: 'sub-2',
				user_id: 'user-2',
				current_period_end: new Date('2024-01-02T00:00:00Z'),
				billing_payment_method_id: 'pm-2',
			}),
		);

		const summary = await service.runBillingCycle({ now: new Date('2024-02-01T00:00:00Z') });

		expect(summary).to.deep.equal({ processed: 3, charged: 3, skipped: 0, failed: 0 });
		const chargedUserIds = yookassa.calls.map(params => params.metadata.user_id);
		expect(chargedUserIds).to.deep.equal(['user-1', 'user-2', 'user-3']);
	});

	it('stops processing when application shutdown interrupts a billing run', async () => {
		const repository = new InMemorySubscriptionRepository();
		const yookassa = new DelayedYookassaClient(25, {
			nextPayment: createPaymentResponse({ id: 'payment-delayed' }),
		});

		const service = new SubscriptionBillingService(repository, yookassa, baseConfig);

		for (let i = 0; i < 3; i += 1) {
			repository.addCandidate(
				createCandidate({
					id: `sub-${i}`,
					user_id: `user-${i}`,
					billing_payment_method_id: `pm-${i}`,
				}),
			);
		}

		const controller = new AbortController();
		const runPromise = service.runBillingCycle({ now: new Date(), signal: controller.signal });
		await wait(5);
		controller.abort();

		const summary = await runPromise;

		expect(summary).to.deep.equal({ processed: 1, charged: 1, skipped: 0, failed: 0 });
		expect(repository.recordedEvents.filter(event => event.type === BillingEventType.ATTEMPT_PREPARED)).to.have.length(
			1,
		);
	});
});

class FakeYookassaClient implements YookassaClientPort {
	public chargeCalls = 0;
	protected readonly nextPayment: YookassaPaymentResponse;

	constructor(params?: { nextPayment?: YookassaPaymentResponse }) {
		this.nextPayment = params?.nextPayment ?? createPaymentResponse();
	}

	chargeSavedPaymentMethod(_params?: ChargeSavedPaymentParams): Promise<YookassaPaymentResponse> {
		this.chargeCalls += 1;
		return Promise.resolve(this.nextPayment);
	}

	createPaymentForm(): Promise<YookassaPaymentResponse> {
		throw new Error('Not implemented in FakeYookassaClient');
	}
}

class DelayedYookassaClient extends FakeYookassaClient {
	private readonly delayMs: number;

	constructor(delayMs: number, params?: { nextPayment?: YookassaPaymentResponse }) {
		super(params);
		this.delayMs = delayMs;
	}

	async chargeSavedPaymentMethod(params?: ChargeSavedPaymentParams): Promise<YookassaPaymentResponse> {
		await wait(this.delayMs);
		return super.chargeSavedPaymentMethod(params);
	}
}

class HookedYookassaClient extends FakeYookassaClient {
	private readonly onCharge?: (params: ChargeSavedPaymentParams) => void | Promise<void>;
	public readonly calls: ChargeSavedPaymentParams[] = [];

	constructor(params?: {
		nextPayment?: YookassaPaymentResponse;
		onCharge?: (params: ChargeSavedPaymentParams) => void | Promise<void>;
	}) {
		super(params);
		this.onCharge = params?.onCharge;
	}

	async chargeSavedPaymentMethod(params: ChargeSavedPaymentParams): Promise<YookassaPaymentResponse> {
		this.calls.push(params);
		if (this.onCharge) {
			await this.onCharge(params);
		}
		return super.chargeSavedPaymentMethod(params);
	}
}

const createPaymentResponse = (overrides: Partial<YookassaPaymentResponse> = {}): YookassaPaymentResponse => ({
	id: overrides.id ?? 'payment-default',
	status: overrides.status ?? 'succeeded',
	paid: overrides.paid ?? true,
	amount: overrides.amount ?? { value: '0.00', currency: 'RUB' },
	confirmation:
		overrides.confirmation ??
		({
			type: 'redirect',
			confirmation_url: 'https://example.test',
		} as const),
	metadata: overrides.metadata ?? {},
	created_at: overrides.created_at ?? new Date().toISOString(),
});

const wait = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));
