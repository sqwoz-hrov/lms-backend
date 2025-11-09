import { expect } from 'chai';
import { YookassaClientPort, YookassaPaymentResponse } from '../../yookassa/services/yookassa-client.interface';
import { BillableSubscriptionRow } from '../subscription.repository';
import { InMemoryBillingPersistence } from '../test-utils/in-memory-billing-persistence';
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
		const persistence = new InMemoryBillingPersistence({ retryWindowDays: baseConfig.retryWindowDays });
		const service = new SubscriptionBillingService(persistence, new FakeYookassaClient(), {
			...baseConfig,
			enabled: false,
		});

		const summary = await service.runBillingCycle();

		expect(summary).to.deep.equal({ processed: 0, charged: 0, skipped: 0, failed: 0 });
		expect(persistence.fetchCalls).to.equal(0);
	});

	it('skips billing when persistence cannot load the subscription', async () => {
		const persistence = new InMemoryBillingPersistence({ retryWindowDays: baseConfig.retryWindowDays });
		const service = new SubscriptionBillingService(persistence, new FakeYookassaClient(), baseConfig);

		const candidate = createCandidate({ user_id: 'user-missing' });
		persistence.addCandidate(candidate);

		// Simulate a stale queue entry whose subscription was removed upstream.
		const internals = persistence as unknown as { subscriptions: Map<string, unknown> };
		internals.subscriptions.delete(candidate.user_id);

		const summary = await service.runBillingCycle(new Date());

		expect(summary).to.deep.equal({ processed: 1, charged: 0, skipped: 1, failed: 0 });
		expect(persistence.recordedEvents).to.have.length(0);
	});

	it('skips billing when subscription is not due yet', async () => {
		const persistence = new InMemoryBillingPersistence({ retryWindowDays: baseConfig.retryWindowDays });
		const service = new SubscriptionBillingService(persistence, new FakeYookassaClient(), baseConfig);

		const runDate = new Date('2024-05-10T06:00:00Z');
		const candidate = createCandidate({
			user_id: 'user-not-due',
			current_period_end: new Date('2024-05-15T00:00:00Z'),
		});

		persistence.addCandidate(candidate);

		const summary = await service.runBillingCycle(runDate);

		expect(summary).to.deep.equal({ processed: 1, charged: 0, skipped: 1, failed: 0 });
		expect(persistence.recordedEvents).to.have.length(0);
	});

	it('charges due subscriptions and records success', async () => {
		const persistence = new InMemoryBillingPersistence({ retryWindowDays: baseConfig.retryWindowDays });
		const yookassa = new FakeYookassaClient({
			nextPayment: createPaymentResponse({ id: 'payment-1' }),
		});

		const service = new SubscriptionBillingService(persistence, yookassa, baseConfig);

		const candidate = createCandidate();
		persistence.addCandidate(candidate);

		const summary = await service.runBillingCycle(new Date());

		expect(summary).to.deep.equal({ processed: 1, charged: 1, skipped: 0, failed: 0 });

		expect(yookassa.chargeCalls).to.equal(1);
		const attemptEvents = persistence.recordedEvents.filter(
			event => event.type === BillingEventType.ATTEMPT_PREPARED,
		) as Array<{
			type: BillingEventType.ATTEMPT_PREPARED;
			subscriptionId: string;
			attemptId: string;
		}>;
		const successEvents = persistence.recordedEvents.filter(
			event => event.type === BillingEventType.CHARGE_REQUESTED,
		) as Array<{
			type: BillingEventType.CHARGE_REQUESTED;
			subscriptionId: string;
			attemptId: string;
			paymentId: string;
		}>;

		expect(attemptEvents).to.have.length(1);
		expect(successEvents).to.have.length(1);
		expect(successEvents[0]?.subscriptionId).to.equal(candidate.id);
		expect(successEvents[0]?.paymentId).to.equal('payment-1');
		expect(successEvents[0]?.attemptId).to.equal(attemptEvents[0]?.attemptId);
	});

	it('stops processing when application shutdown interrupts a billing run', async () => {
		const persistence = new InMemoryBillingPersistence({ retryWindowDays: baseConfig.retryWindowDays });
		const yookassa = new DelayedYookassaClient(25, {
			nextPayment: createPaymentResponse({ id: 'payment-delayed' }),
		});

		const service = new SubscriptionBillingService(persistence, yookassa, baseConfig);

		for (let i = 0; i < 3; i += 1) {
			persistence.addCandidate(
				createCandidate({
					id: `sub-${i}`,
					user_id: `user-${i}`,
					billing_payment_method_id: `pm-${i}`,
				}),
			);
		}

		const runPromise = service.runBillingCycle(new Date());
		await wait(5);
		service.onApplicationShutdown();

		const summary = await runPromise;

		expect(summary).to.deep.equal({ processed: 1, charged: 1, skipped: 0, failed: 0 });
		expect(persistence.recordedEvents.filter(event => event.type === BillingEventType.ATTEMPT_PREPARED)).to.have.length(
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

	chargeSavedPaymentMethod(): Promise<YookassaPaymentResponse> {
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

	async chargeSavedPaymentMethod(): Promise<YookassaPaymentResponse> {
		await wait(this.delayMs);
		return super.chargeSavedPaymentMethod();
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
