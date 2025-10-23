import { expect } from 'chai';
import { SubscriptionTier } from '../../user/user.entity';
import { SubscriptionManager } from './subscription.manager';
import { SubscriptionDraft, SubscriptionState } from '../subscription.entity';

const freeTier: SubscriptionTier = {
	id: 'tier-free',
	tier: 'free',
	permissions: [],
};

const paidTier: SubscriptionTier = {
	id: 'tier-paid',
	tier: 'paid',
	permissions: [],
};

const defaultTiers = [freeTier, paidTier];

const BASE_DATE = new Date('2024-01-01T00:00:00.000Z');

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

const buildManager = () =>
	new SubscriptionManager(defaultTiers, {
		defaultBillingPeriodDays: 30,
		defaultGracePeriodSize: 3,
		freeTierCode: 'free',
	});

const buildSubscriptionState = (overrides: Partial<SubscriptionState> = {}): SubscriptionState => ({
	id: overrides.id ?? 'sub-1',
	user_id: overrides.user_id ?? 'user-1',
	subscription_tier_id: overrides.subscription_tier_id ?? paidTier.id,
	status: overrides.status ?? 'active',
	price_on_purchase_rubles: overrides.price_on_purchase_rubles ?? 1500,
	is_gifted: overrides.is_gifted ?? false,
	grace_period_size: overrides.grace_period_size ?? 3,
	billing_period_days: overrides.billing_period_days ?? 30,
	payment_method_id: overrides.payment_method_id ?? 'pm-1',
	current_period_end: overrides.current_period_end ?? new Date(BASE_DATE),
	next_billing_at: overrides.next_billing_at ?? new Date(BASE_DATE),
	billing_retry_attempts: overrides.billing_retry_attempts ?? 0,
	last_billing_attempt: overrides.last_billing_attempt ?? new Date(BASE_DATE),
});

const expectDraftMatches = (draft: SubscriptionDraft, expected: Partial<SubscriptionDraft>) => {
	for (const [key, value] of Object.entries(expected)) {
		expect(draft[key]).to.deep.equal(value);
	}
};

describe('SubscriptionManager', () => {
	describe('handleRegistration', () => {
		it('creates free subscription draft for new user', () => {
			const manager = buildManager();
			const now = new Date('2024-03-01T10:00:00.000Z');

			const { action } = manager.handleRegistration({
				user: { id: 'user-42' },
				now,
			});

			expect(action.do).to.equal('create');

			expectDraftMatches(action.subscription, {
				user_id: 'user-42',
				subscription_tier_id: freeTier.id,
				status: 'active',
				is_gifted: true,
				grace_period_size: 3,
				billing_period_days: 0,
				current_period_end: now,
				next_billing_at: null,
				price_on_purchase_rubles: 0,
			});
		});
	});

	describe('handleGift', () => {
		it('creates gifted subscription for user without existing subscription', () => {
			const manager = buildManager();
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
				status: 'active',
				billing_period_days: 45,
				grace_period_size: 2,
				current_period_end: addDays(now, 45),
				next_billing_at: null,
				price_on_purchase_rubles: 0,
			});
		});

		it('prolongs existing gifted subscription of the same tier', () => {
			const manager = buildManager();

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
				status: 'active',
				billing_period_days: 15,
				grace_period_size: 4,
			});
			expect(action.subscription.current_period_end).to.deep.equal(addDays(currentPeriodEnd, 15));
			expect(action.subscription.next_billing_at).to.equal(null);
		});
	});

	describe('handleBillingCron', () => {
		it('marks retry within grace period as past due', () => {
			const manager = buildManager();
			const now = new Date('2024-05-01T12:00:00.000Z');
			const subscription = buildSubscriptionState({
				status: 'active',
				billing_retry_attempts: 0,
				grace_period_size: 2,
				is_gifted: false,
				current_period_end: addDays(now, 5),
				next_billing_at: now,
			});

			const { action } = manager.handleBillingCron({
				user: { id: subscription.user_id },
				subscription,
				outcome: 'failure',
				now,
			});

			expect(action.do).to.equal('update_data');
			expect(action.subscription.status).to.equal('past_due');
			expect(action.subscription.billing_retry_attempts).to.equal(1);
			expect(action.subscription.next_billing_at?.getTime()).to.equal(addDays(now, 1).getTime());
		});

		it('cancels subscription when retries exceed grace', () => {
			const manager = buildManager();
			const now = new Date('2024-06-01T09:00:00.000Z');
			const subscription = buildSubscriptionState({
				billing_retry_attempts: 3,
				grace_period_size: 3,
				is_gifted: false,
				status: 'past_due',
			});

			const { action } = manager.handleBillingCron({
				user: { id: subscription.user_id },
				subscription,
				outcome: 'failure',
				now,
			});

			expect(action.do).to.equal('delete');
			expect(action.subscription.status).to.equal('canceled');
			expect(action.subscription.billing_retry_attempts).to.equal(4);
		});

		it('prolongs subscription after successful billing', () => {
			const manager = buildManager();
			const now = new Date('2024-07-01T08:00:00.000Z');
			const originalEnd = new Date('2024-07-05T00:00:00.000Z');
			const subscription = buildSubscriptionState({
				is_gifted: false,
				current_period_end: originalEnd,
				next_billing_at: originalEnd,
				billing_retry_attempts: 1,
			});

			const { action } = manager.handleBillingCron({
				user: { id: subscription.user_id },
				subscription,
				outcome: 'success',
				now,
			});

			expect(action.do).to.equal('prolong');
			const expectedEnd = addDays(originalEnd, subscription.billing_period_days);
			expect(action.subscription.current_period_end.getTime()).to.equal(expectedEnd.getTime());
			expect(action.subscription.next_billing_at?.getTime()).to.equal(expectedEnd.getTime());
			expect(action.subscription.billing_retry_attempts).to.equal(0);
		});
	});

	describe('handlePaymentEvent', () => {
		it('prolongs subscription on payment success and keeps payment schedule', () => {
			const manager = buildManager();
			const occurredAt = new Date('2024-08-01T12:00:00.000Z');
			const currentEnd = new Date('2024-08-05T00:00:00.000Z');
			const subscription = buildSubscriptionState({
				is_gifted: false,
				current_period_end: currentEnd,
				next_billing_at: currentEnd,
				billing_retry_attempts: 2,
			});

			const { action } = manager.handlePaymentEvent({
				user: { id: subscription.user_id },
				subscription,
				event: { type: 'payment.succeeded', occurredAt },
				now: new Date('2024-08-01T13:00:00.000Z'),
			});

			expect(action.do).to.equal('prolong');
			const expectedEnd = addDays(currentEnd, subscription.billing_period_days);
			expect(action.subscription.status).to.equal('active');
			expect(action.subscription.current_period_end.getTime()).to.equal(expectedEnd.getTime());
			expect(action.subscription.next_billing_at?.getTime()).to.equal(expectedEnd.getTime());
			expect(action.subscription.billing_retry_attempts).to.equal(0);
			expect(action.subscription.last_billing_attempt?.getTime()).to.equal(occurredAt.getTime());
		});

		it('cancels subscription on payment cancellation', () => {
			const manager = buildManager();
			const subscription = buildSubscriptionState({
				status: 'past_due',
				is_gifted: false,
				billing_retry_attempts: 1,
			});
			const canceledAt = new Date('2024-09-15T10:00:00.000Z');

			const { action } = manager.handlePaymentEvent({
				user: { id: subscription.user_id },
				subscription,
				event: { type: 'payment.canceled', occurredAt: canceledAt },
			});

			expect(action.do).to.equal('delete');
			expect(action.subscription.status).to.equal('canceled');
			expect(action.subscription.next_billing_at).to.equal(null);
			expect(action.subscription.last_billing_attempt?.getTime()).to.equal(canceledAt.getTime());
		});
	});
});
