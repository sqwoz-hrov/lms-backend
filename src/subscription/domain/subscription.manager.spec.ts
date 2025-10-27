import { expect } from 'chai';
import { SubscriptionTier } from '../../user/user.entity';
import { SubscriptionManager } from './subscription.manager';
import { SubscriptionDraft, SubscriptionState } from '../subscription.entity';

const freeTier: SubscriptionTier = {
	id: 'tier-free',
	tier: 'free',
	power: 0,
	permissions: [],
};

const paidTier: SubscriptionTier = {
	id: 'tier-paid',
	tier: 'paid',
	power: 1,
	permissions: [],
};

const premiumTier: SubscriptionTier = {
	id: 'tier-premium',
	tier: 'premium',
	power: 2,
	permissions: [],
};

const defaultTiers = [freeTier, paidTier, premiumTier];

const BASE_DATE = new Date('2024-01-01T00:00:00.000Z');

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

const createManager = () =>
	new SubscriptionManager(defaultTiers, {
		defaultBillingPeriodDays: 30,
		defaultGracePeriodSize: 3,
	});

const buildSubscriptionState = (overrides: Partial<SubscriptionState> = {}): SubscriptionState => ({
	id: overrides.id ?? 'sub-1',
	user_id: overrides.user_id ?? 'user-1',
	subscription_tier_id: overrides.subscription_tier_id ?? paidTier.id,
	price_on_purchase_rubles: overrides.price_on_purchase_rubles ?? 1500,
	is_gifted: overrides.is_gifted ?? false,
	grace_period_size: overrides.grace_period_size ?? 3,
	billing_period_days: overrides.billing_period_days ?? 30,
	current_period_end: overrides.current_period_end !== undefined ? overrides.current_period_end : new Date(BASE_DATE),
	last_billing_attempt:
		overrides.last_billing_attempt !== undefined ? overrides.last_billing_attempt : new Date(BASE_DATE),
});

const expectDraftMatches = (draft: SubscriptionDraft, expected: Partial<SubscriptionDraft>) => {
	for (const [key, value] of Object.entries(expected)) {
		expect(draft[key]).to.deep.equal(value);
	}
};

describe('SubscriptionManager', () => {
	describe('handleRegistration', () => {
		it('creates free tier subscription for new user', () => {
			const manager = createManager();
			const now = new Date('2024-03-01T10:00:00.000Z');

			const { action } = manager.handleRegistration({
				user: { id: 'user-42' },
				now,
			});

			expect(action.do).to.equal('create');

			expectDraftMatches(action.subscription, {
				user_id: 'user-42',
				subscription_tier_id: freeTier.id,
				is_gifted: true,
				grace_period_size: 3,
				billing_period_days: 0,
				current_period_end: null,
				price_on_purchase_rubles: 0,
			});
		});
	});

	describe('handleGift', () => {
		it('creates gifted subscription for user without existing subscription', () => {
			const manager = createManager();
			const now = new Date('2024-05-10T09:30:00.000Z');

			const { action } = manager.handleGift({
				user: { id: 'user-777' },
				targetTier: paidTier,
				durationDays: 45,
				gracePeriodSize: 2,
				now,
			});

			expect(action.do).to.equal('create');

			expectDraftMatches(action.subscription, {
				user_id: 'user-777',
				subscription_tier_id: paidTier.id,
				is_gifted: true,
				billing_period_days: 45,
				grace_period_size: 2,
				current_period_end: addDays(now, 45),
				price_on_purchase_rubles: 0,
			});
		});

		it('prolongs existing gifted subscription of the same tier', () => {
			const manager = createManager();

			const currentPeriodEnd = new Date('2024-04-01T00:00:00.000Z');
			const now = new Date('2024-03-01T00:00:00.000Z');
			const existing = buildSubscriptionState({
				current_period_end: currentPeriodEnd,
				is_gifted: true,
				subscription_tier_id: paidTier.id,
				grace_period_size: 4,
				billing_period_days: 40,
			});

			const { action } = manager.handleGift({
				user: { id: existing.user_id },
				targetTier: paidTier,
				durationDays: 15,
				existingSubscription: existing,
				now,
			});

			expect(action.do).to.equal('prolong');

			expect(action.subscription).to.include({
				id: existing.id,
				user_id: existing.user_id,
				subscription_tier_id: paidTier.id,
				is_gifted: true,
				billing_period_days: 40,
				grace_period_size: 4,
			});
			expect(action.subscription.current_period_end).to.deep.equal(addDays(currentPeriodEnd, 15));
		});

		it('upgrades existing subscription to a higher tier', () => {
			const manager = createManager();
			const now = new Date('2024-03-10T00:00:00.000Z');
			const existing = buildSubscriptionState({
				subscription_tier_id: paidTier.id,
				current_period_end: addDays(now, 10),
				is_gifted: false,
				billing_period_days: 30,
			});

			const { action } = manager.handleGift({
				user: { id: existing.user_id },
				targetTier: premiumTier,
				durationDays: 20,
				existingSubscription: existing,
				now,
			});

			expect(action.do).to.equal('update_data');
			expect(action.subscription).to.include({
				id: existing.id,
				user_id: existing.user_id,
				subscription_tier_id: premiumTier.id,
				is_gifted: true,
				price_on_purchase_rubles: 0,
			});
			expect(action.subscription.current_period_end).to.deep.equal(addDays(existing.current_period_end as Date, 20));
		});

		it('throws when trying to downgrade subscription tier', () => {
			const manager = createManager();
			const now = new Date('2024-04-01T00:00:00.000Z');
			const existing = buildSubscriptionState({
				subscription_tier_id: premiumTier.id,
				current_period_end: addDays(now, 5),
				is_gifted: false,
			});

			expect(() =>
				manager.handleGift({
					user: { id: existing.user_id },
					targetTier: paidTier,
					durationDays: 10,
					existingSubscription: existing,
					now,
				}),
			).to.throw('Cannot downgrade subscription tier from "premium" to "paid"');
		});
	});

	describe('handleBillingCron', () => {
		it('keeps subscription active and schedules retry within grace period', () => {
			const manager = createManager();
			const now = new Date('2024-05-01T12:00:00.000Z');
			const subscription = buildSubscriptionState({
				grace_period_size: 2,
				is_gifted: false,
				current_period_end: addDays(now, 5),
				last_billing_attempt: null,
			});

			const { action } = manager.handleBillingCron({
				user: { id: subscription.user_id },
				subscription,
				outcome: 'failure',
				now,
			});

			expect(action.do).to.equal('update_data');
			expect(action.subscription.subscription_tier_id).to.equal(subscription.subscription_tier_id);
			expect(action.subscription.current_period_end?.getTime()).to.equal(subscription.current_period_end?.getTime());
			expect(action.subscription.last_billing_attempt?.getTime()).to.equal(now.getTime());
		});

		it('downgrades subscription to free tier when grace period expired', () => {
			const manager = createManager();
			const periodEnd = new Date('2024-05-20T00:00:00.000Z');
			const now = addDays(periodEnd, 4);
			const subscription = buildSubscriptionState({
				current_period_end: periodEnd,
				grace_period_size: 3,
				is_gifted: false,
			});

			const { action } = manager.handleBillingCron({
				user: { id: subscription.user_id },
				subscription,
				outcome: 'failure',
				now,
			});

			expect(action.do).to.equal('update_data');
			expect(action.subscription.subscription_tier_id).to.equal(freeTier.id);
			expect(action.subscription.billing_period_days).to.equal(0);
			expect(action.subscription.current_period_end).to.equal(null);
			expect(action.subscription.is_gifted).to.equal(true);
			expect(action.subscription.last_billing_attempt?.getTime()).to.equal(now.getTime());
		});

		it('prolongs subscription after successful billing', () => {
			const manager = createManager();
			const now = new Date('2024-07-01T08:00:00.000Z');
			const originalEnd = new Date('2024-07-05T00:00:00.000Z');
			const subscription = buildSubscriptionState({
				is_gifted: false,
				current_period_end: originalEnd,
				last_billing_attempt: addDays(originalEnd, -1),
			});

			const { action } = manager.handleBillingCron({
				user: { id: subscription.user_id },
				subscription,
				outcome: 'success',
				now,
			});

			expect(action.do).to.equal('prolong');
			const expectedEnd = addDays(originalEnd, subscription.billing_period_days);
			expect(action.subscription.current_period_end?.getTime()).to.equal(expectedEnd.getTime());
			expect(action.subscription.last_billing_attempt?.getTime()).to.equal(now.getTime());
		});

		it('prolongs subscription after successful billing when now is after period end but within grace', () => {
			const manager = createManager();
			const originalEnd = new Date('2024-08-01T00:00:00.000Z');
			const now = new Date('2024-08-04T10:00:00.000Z');
			const subscription = buildSubscriptionState({
				is_gifted: false,
				current_period_end: originalEnd,
				grace_period_size: 5,
				last_billing_attempt: addDays(originalEnd, 1),
			});

			const { action } = manager.handleBillingCron({
				user: { id: subscription.user_id },
				subscription,
				outcome: 'success',
				now,
			});

			expect(action.do).to.equal('prolong');
			const expectedEnd = addDays(now, subscription.billing_period_days);
			expect(action.subscription.current_period_end?.getTime()).to.equal(expectedEnd.getTime());
			expect(action.subscription.last_billing_attempt?.getTime()).to.equal(now.getTime());
		});
	});

	describe('handlePaymentEvent', () => {
		it('prolongs subscription on payment success and keeps payment schedule', () => {
			const manager = createManager();
			const occurredAt = new Date('2024-08-01T12:00:00.000Z');
			const currentEnd = new Date('2024-08-05T00:00:00.000Z');
			const subscription = buildSubscriptionState({
				is_gifted: false,
				current_period_end: currentEnd,
				last_billing_attempt: addDays(currentEnd, -2),
			});

			const { action } = manager.handlePaymentEvent({
				user: { id: subscription.user_id },
				subscription,
				event: { type: 'payment.succeeded', occurredAt },
				now: new Date('2024-08-01T13:00:00.000Z'),
			});

			expect(action.do).to.equal('prolong');
			const expectedEnd = addDays(currentEnd, subscription.billing_period_days);
			expect(action.subscription.current_period_end?.getTime()).to.equal(expectedEnd.getTime());
			expect(action.subscription.last_billing_attempt?.getTime()).to.equal(occurredAt.getTime());
		});

		it('downgrades to free tier on payment cancellation outside grace period', () => {
			const manager = createManager();
			const periodEnd = new Date('2024-09-10T00:00:00.000Z');
			const subscription = buildSubscriptionState({
				is_gifted: false,
				current_period_end: periodEnd,
				grace_period_size: 3,
			});
			const canceledAt = addDays(periodEnd, 5);

			const { action } = manager.handlePaymentEvent({
				user: { id: subscription.user_id },
				subscription,
				event: { type: 'payment.canceled', occurredAt: canceledAt },
			});

			expect(action.do).to.equal('update_data');
			expect(action.subscription.subscription_tier_id).to.equal(freeTier.id);
			expect(action.subscription.current_period_end).to.equal(null);
			expect(action.subscription.is_gifted).to.equal(true);
			expect(action.subscription.last_billing_attempt?.getTime()).to.equal(canceledAt.getTime());
		});

		it('keeps subscription when payment cancellation happens within grace period', () => {
			const manager = createManager();
			const periodEnd = new Date('2024-09-10T00:00:00.000Z');
			const subscription = buildSubscriptionState({
				is_gifted: false,
				current_period_end: periodEnd,
				grace_period_size: 5,
			});
			const canceledAt = addDays(periodEnd, 2);

			const { action } = manager.handlePaymentEvent({
				user: { id: subscription.user_id },
				subscription,
				event: { type: 'payment.canceled', occurredAt: canceledAt },
			});

			expect(action.do).to.equal('update_data');
			expect(action.subscription.subscription_tier_id).to.equal(subscription.subscription_tier_id);
			expect(action.subscription.current_period_end?.getTime()).to.equal(subscription.current_period_end?.getTime());
			expect(action.subscription.last_billing_attempt?.getTime()).to.equal(canceledAt.getTime());
		});
	});
});
