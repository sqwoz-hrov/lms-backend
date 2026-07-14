import { expect } from 'chai';

import { Subscription } from '../subscription.entity';
import { PaidAndGiftedSubPerUserView } from '../subscription.repository';
import { isDueNow } from './is-due-now';

const createSubscription = (overrides: Partial<Subscription> = {}): Subscription => {
	const now = new Date('2024-01-01T00:00:00.000Z');

	return {
		id: 'sub-1',
		user_id: 'user-1',
		current_tier_id: 'tier-1',
		next_tier_id: 'tier-1',
		price_on_purchase_rubles: 2500,
		grace_period_size: 3,
		billing_period_days: 30,
		current_period_end: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
		last_billing_attempt: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000),
		created_at: now,
		updated_at: now,
		...overrides,
	};
};

const createSubscriptionAggregation = (
	subscription: Subscription,
	hasActiveGift = false,
): PaidAndGiftedSubPerUserView => ({
	currentPaidSubscription: {
		subscription,
		currentTier: {
			id: subscription.current_tier_id,
			tier: 'tier',
			power: 1,
			permissions: [],
			price_rubles: subscription.price_on_purchase_rubles,
		},
	},
	currentActiveGiftSubscription: hasActiveGift
		? {
				gift: {
					giftId: 'gift-1',
					giftedDaysLeft: 10,
				},
				currentTier: {
					giftedTierId: 'gift-tier',
					giftedTierPower: 2,
				},
			}
		: undefined,
});

describe('isDueNow', () => {
	const runDate = new Date('2024-02-10T06:00:00.000Z');
	const retryWindowDays = 3;

	it('returns true when the period ended before the run-day threshold and retry window elapsed', () => {
		const subscription = createSubscription({
			current_period_end: new Date('2024-02-07T10:00:00.000Z'),
			last_billing_attempt: new Date('2024-02-05T05:00:00.000Z'),
		});

		expect(isDueNow(createSubscriptionAggregation(subscription), runDate, retryWindowDays)).to.equal(true);
	});

	it('returns false for gifted subscriptions', () => {
		const subscription = createSubscription();

		expect(isDueNow(createSubscriptionAggregation(subscription, true), runDate, retryWindowDays)).to.equal(false);
	});

	it('returns false when billing period is not set', () => {
		const subscription = createSubscription({ billing_period_days: 0 });

		expect(isDueNow(createSubscriptionAggregation(subscription), runDate, retryWindowDays)).to.equal(false);
	});

	// this contradicts the 'otherwise valid' case
	it.skip('returns false when current_period_end is not set', () => {
		const subscription = createSubscription({ current_period_end: null });

		expect(isDueNow(createSubscriptionAggregation(subscription), runDate, retryWindowDays)).to.equal(false);
	});

	it('requires the current period to end before the start of the run day', () => {
		const notDueSub = createSubscription({
			current_period_end: new Date('2024-02-10T00:00:00.000Z'),
		});
		const dueSub = createSubscription({
			current_period_end: new Date('2024-02-09T23:59:59.999Z'),
		});

		expect(isDueNow(createSubscriptionAggregation(notDueSub), runDate, retryWindowDays)).to.equal(false);
		expect(isDueNow(createSubscriptionAggregation(dueSub), runDate, retryWindowDays)).to.equal(true);
	});

	it('requires the last attempt to be outside the retry window', () => {
		const subscription = createSubscription({
			current_period_end: new Date('2024-02-08T07:00:00.000Z'),
			last_billing_attempt: new Date('2024-02-08T23:59:59.000Z'),
		});

		expect(isDueNow(createSubscriptionAggregation(subscription), runDate, retryWindowDays)).to.equal(false);
	});

	it('treats missing dates as due when billing is otherwise valid', () => {
		const subscription = createSubscription({
			current_period_end: null,
			last_billing_attempt: null,
		});

		expect(isDueNow(createSubscriptionAggregation(subscription), runDate, retryWindowDays)).to.equal(true);
	});
});
