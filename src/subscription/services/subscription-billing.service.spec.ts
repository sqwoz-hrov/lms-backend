import { expect } from 'chai';
import * as sinon from 'sinon';
import { Subscription } from '../subscription.entity';
import { BillableSubscriptionRow, SubscriptionRepository } from '../subscription.repository';
import { SubscriptionBillingService } from './subscription-billing.service';

const baseConfig = {
	enabled: true,
	dailyTime: '05:00',
	batchSize: 50,
	leadDays: 3,
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
		billing_payment_method_type: overrides.billing_payment_method_type ?? 'bank_card',
	};
};

describe('SubscriptionBillingService', () => {
	let repository: sinon.SinonStubbedInstance<SubscriptionRepository>;

	beforeEach(() => {
		repository = sinon.createStubInstance(SubscriptionRepository);
	});

	afterEach(() => {
		sinon.restore();
	});

	it('skips execution when billing disabled', async () => {
		const service = new SubscriptionBillingService(
			repository as unknown as SubscriptionRepository,
			{
				chargeSavedPaymentMethod: sinon.stub(),
				createPaymentForm: sinon.stub(),
			},
			{ ...baseConfig, enabled: false },
		);

		const summary = await service.runBillingCycle();

		expect(summary).to.deep.equal({ processed: 0, charged: 0, skipped: 0, failed: 0 });
		sinon.assert.notCalled(repository.findBillableSubscriptions);
	});

	it('charges due subscriptions and records success', async () => {
		const service = new SubscriptionBillingService(
			repository as unknown as SubscriptionRepository,
			{
				chargeSavedPaymentMethod: sinon.stub().resolves({
					id: 'payment-1',
					created_at: new Date().toISOString(),
				}),
				createPaymentForm: sinon.stub(),
			},
			baseConfig,
		);

		const candidate = createCandidate();
		const lockedSubscription: Subscription = {
			...candidate,
			created_at: candidate.created_at,
			updated_at: candidate.updated_at,
		};

		repository.findBillableSubscriptions.onFirstCall().resolves([candidate]);
		repository.findBillableSubscriptions.onSecondCall().resolves([]);
		repository.transaction.callsFake(async handler => handler({} as never));
		repository.lockByUserId.resolves(lockedSubscription);
		repository.update.resolves(lockedSubscription);
		repository.insertPaymentEvent.resolves({
			id: 'event-1',
			user_id: lockedSubscription.user_id,
			subscription_id: lockedSubscription.id,
			event: {},
			created_at: new Date(),
		});

		const summary = await service.runBillingCycle(new Date());

		expect(summary).to.deep.equal({ processed: 1, charged: 1, skipped: 0, failed: 0 });
		sinon.assert.calledTwice(repository.insertPaymentEvent);
		sinon.assert.calledOnce(repository.update);
	});
});
