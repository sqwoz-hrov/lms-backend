import { expect } from 'chai';
import { YookassaClientPort, YookassaPaymentResponse } from '../../yookassa/services/yookassa-client.interface';
import { BillableSubscriptionRow } from '../subscription.repository';
import { InMemoryBillingPersistence } from '../test-utils/in-memory-billing-persistence';
import { SubscriptionBillingService } from './subscription-billing.service';

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
		const attemptEvents = persistence.recordedEvents.filter(event => event.type === 'billing.attempt') as Array<{
			type: 'billing.attempt';
			subscriptionId: string;
			attemptId: string;
		}>;
		const successEvents = persistence.recordedEvents.filter(event => event.type === 'billing.success') as Array<{
			type: 'billing.success';
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
});

class FakeYookassaClient implements YookassaClientPort {
	public chargeCalls = 0;
	private readonly nextPayment: YookassaPaymentResponse;

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
