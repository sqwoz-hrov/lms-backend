import { expect } from 'chai';
import { SubscriptionTier } from '../../subscription-tier/subscription-tier.entity';
import { SubscriptionState } from '../subscription.entity';
import { PaidAndGiftedSubPerUserView } from '../subscription.repository';
import { SubscriptionStateService } from './subscription.state';

const freeTier: SubscriptionTier = {
	id: 'tier-free',
	tier: 'free',
	power: 0,
	permissions: [],
	price_rubles: 0,
	is_archived: false,
	markdown_description_id: null,
};

const paidTier: SubscriptionTier = {
	id: 'tier-paid',
	tier: 'paid',
	power: 1,
	permissions: [],
	price_rubles: 2000,
	is_archived: false,
	markdown_description_id: null,
};

const premiumTier: SubscriptionTier = {
	id: 'tier-premium',
	tier: 'premium',
	power: 2,
	permissions: [],
	price_rubles: 4000,
	is_archived: false,
	markdown_description_id: null,
};

const tiers = new Map<string, SubscriptionTier>([freeTier, paidTier, premiumTier].map(tier => [tier.id, tier]));

const BASE_DATE = new Date('2024-01-01T00:00:00.000Z');
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
const paidAmount = (tier: SubscriptionTier) => ({ value: tier.price_rubles.toString(), currency: 'RUB' as const });

const createService = () =>
	new SubscriptionStateService({
		defaultBillingPeriodDays: 30,
		defaultGracePeriodSize: 3,
	});

const buildSubscriptionState = (overrides: Partial<SubscriptionState> = {}): SubscriptionState => ({
	id: overrides.id ?? 'sub-1',
	user_id: overrides.user_id ?? 'user-1',
	current_tier_id: overrides.current_tier_id ?? paidTier.id,
	next_tier_id: overrides.next_tier_id ?? paidTier.id,
	price_on_purchase_rubles: overrides.price_on_purchase_rubles ?? 1500,
	grace_period_size: overrides.grace_period_size ?? 3,
	billing_period_days: overrides.billing_period_days ?? 30,
	current_period_end: overrides.current_period_end !== undefined ? overrides.current_period_end : new Date(BASE_DATE),
	last_billing_attempt:
		overrides.last_billing_attempt !== undefined ? overrides.last_billing_attempt : new Date(BASE_DATE),
});

const buildAggregation = (
	subscription: SubscriptionState,
	params: { giftedTier?: SubscriptionTier; giftedDaysLeft?: number } = {},
): PaidAndGiftedSubPerUserView => ({
	currentPaidSubscription: {
		subscription: {
			...subscription,
			created_at: BASE_DATE,
			updated_at: BASE_DATE,
		},
		currentTier: tiers.get(subscription.current_tier_id) ?? paidTier,
		nextTier: tiers.get(subscription.next_tier_id) ?? paidTier,
	},
	currentActiveGiftSubscription: params.giftedTier
		? {
				gift: {
					giftId: 'gift-1',
					giftedDaysLeft: params.giftedDaysLeft ?? 10,
				},
				currentTier: {
					giftedTierId: params.giftedTier.id,
					giftedTierPower: params.giftedTier.power,
				},
			}
		: undefined,
});

type HandlePaymentEventParams = Parameters<SubscriptionStateService['handlePaymentEvent']>[0];

const expectRepeatedHandlingToBeDeeplyEqual = (service: SubscriptionStateService, params: HandlePaymentEventParams) => {
	const firstResult = service.handlePaymentEvent(params);
	const secondResult = service.handlePaymentEvent(params);

	expect(secondResult).to.deep.equal(firstResult);

	return firstResult;
};

describe('SubscriptionStateService', () => {
	it('creates free tier subscription fields for new user', () => {
		const service = createService();

		const draft = service.createFreeTierSubFields({}, freeTier);

		expect(draft).to.deep.include({
			current_tier_id: freeTier.id,
			next_tier_id: freeTier.id,
			price_on_purchase_rubles: 0,
			grace_period_size: 0,
			billing_period_days: 0,
			current_period_end: null,
		});
	});

	it('prolongs subscription on payment success and keeps payment schedule', () => {
		const service = createService();
		const occurredAt = new Date('2024-08-01T12:00:00.000Z');
		const currentEnd = new Date('2024-08-05T00:00:00.000Z');
		const subscription = buildSubscriptionState({
			current_period_end: currentEnd,
			last_billing_attempt: addDays(currentEnd, -2),
		});

		const { newSub } = service.handlePaymentEvent({
			user: { id: subscription.user_id },
			freeTier,
			subscription: buildAggregation(subscription),
			event: {
				type: 'payment.succeeded',
				meta: {
					current_tier_id: subscription.current_tier_id,
					user_id: subscription.user_id,
					targetTierPower: paidTier.power,
					paidAmount: paidAmount(paidTier),
				},
				occurredAt,
			},
		});

		expect(newSub.current_period_end?.getTime()).to.equal(addDays(currentEnd, 30).getTime());
		expect(newSub.last_billing_attempt?.getTime()).to.equal(occurredAt.getTime());
		expect(newSub.current_tier_id).to.equal(subscription.current_tier_id);
		expect(newSub.next_tier_id).to.equal(subscription.next_tier_id);
	});

	it('switches paid subscription to lower metadata tier on payment success', () => {
		const service = createService();
		const occurredAt = new Date('2024-08-10T12:00:00.000Z');
		const currentEnd = new Date('2024-08-15T00:00:00.000Z');
		const subscription = buildSubscriptionState({
			current_tier_id: premiumTier.id,
			next_tier_id: premiumTier.id,
			current_period_end: currentEnd,
		});

		const { newSub } = service.handlePaymentEvent({
			user: { id: subscription.user_id },
			freeTier,
			subscription: buildAggregation(subscription),
			event: {
				type: 'payment.succeeded',
				meta: {
					current_tier_id: paidTier.id,
					user_id: subscription.user_id,
					targetTierPower: paidTier.power,
					paidAmount: paidAmount(paidTier),
				},
				occurredAt,
			},
		});

		expect(newSub.current_tier_id).to.equal(paidTier.id);
		expect(newSub.next_tier_id).to.equal(paidTier.id);
		expect(newSub.current_period_end?.getTime()).to.equal(addDays(currentEnd, 30).getTime());
	});

	it('switches paid subscription to higher metadata tier on payment success', () => {
		const service = createService();
		const occurredAt = new Date('2024-09-01T10:00:00.000Z');
		const currentEnd = new Date('2024-09-05T00:00:00.000Z');
		const subscription = buildSubscriptionState({
			current_tier_id: paidTier.id,
			next_tier_id: paidTier.id,
			current_period_end: currentEnd,
		});

		const { newSub } = service.handlePaymentEvent({
			user: { id: subscription.user_id },
			freeTier,
			subscription: buildAggregation(subscription),
			event: {
				type: 'payment.succeeded',
				meta: {
					current_tier_id: premiumTier.id,
					user_id: subscription.user_id,
					targetTierPower: premiumTier.power,
					paidAmount: paidAmount(premiumTier),
				},
				occurredAt,
			},
		});

		expect(newSub.current_tier_id).to.equal(premiumTier.id);
		expect(newSub.next_tier_id).to.equal(premiumTier.id);
		expect(newSub.current_period_end?.getTime()).to.equal(addDays(currentEnd, 30).getTime());
	});

	it('downgrades to free tier on payment cancellation outside grace period', () => {
		const service = createService();
		const periodEnd = new Date('2024-09-10T00:00:00.000Z');
		const subscription = buildSubscriptionState({
			current_period_end: periodEnd,
			grace_period_size: 3,
		});
		const canceledAt = addDays(periodEnd, 5);

		const { newSub } = service.handlePaymentEvent({
			user: { id: subscription.user_id },
			freeTier,
			subscription: buildAggregation(subscription),
			event: {
				type: 'payment.canceled',
				meta: {
					current_tier_id: subscription.current_tier_id,
					user_id: subscription.user_id,
					targetTierPower: paidTier.power,
					paidAmount: paidAmount(paidTier),
				},
				occurredAt: canceledAt,
			},
		});

		expect(newSub.current_tier_id).to.equal(freeTier.id);
		expect(newSub.next_tier_id).to.equal(freeTier.id);
		expect(newSub.current_period_end).to.equal(null);
		expect(newSub.billing_period_days).to.equal(0);
		expect(newSub.last_billing_attempt?.getTime()).to.equal(canceledAt.getTime());
	});

	it('keeps subscription when payment cancellation happens within grace period', () => {
		const service = createService();
		const periodEnd = new Date('2024-09-10T00:00:00.000Z');
		const subscription = buildSubscriptionState({
			current_period_end: periodEnd,
			grace_period_size: 5,
		});
		const canceledAt = addDays(periodEnd, 2);

		const { newSub } = service.handlePaymentEvent({
			user: { id: subscription.user_id },
			freeTier,
			subscription: buildAggregation(subscription),
			event: {
				type: 'payment.canceled',
				meta: {
					current_tier_id: subscription.current_tier_id,
					user_id: subscription.user_id,
					targetTierPower: paidTier.power,
					paidAmount: paidAmount(paidTier),
				},
				occurredAt: canceledAt,
			},
		});

		expect(newSub.current_tier_id).to.equal(subscription.current_tier_id);
		expect(newSub.next_tier_id).to.equal(subscription.next_tier_id);
		expect(newSub.current_period_end?.getTime()).to.equal(subscription.current_period_end?.getTime());
		expect(newSub.last_billing_attempt?.getTime()).to.equal(canceledAt.getTime());
	});

	it('keeps higher tier active gift on payment failure outside grace while paid subscription downgrades to free', () => {
		const service = createService();
		const periodEnd = new Date('2024-09-10T00:00:00.000Z');
		const subscription = buildSubscriptionState({
			current_tier_id: paidTier.id,
			next_tier_id: paidTier.id,
			current_period_end: periodEnd,
			grace_period_size: 1,
		});
		const canceledAt = addDays(periodEnd, 3);

		const { newSub, newGift } = service.handlePaymentEvent({
			user: { id: subscription.user_id },
			freeTier,
			subscription: buildAggregation(subscription, { giftedTier: premiumTier, giftedDaysLeft: 7 }),
			event: {
				type: 'payment.canceled',
				meta: {
					current_tier_id: paidTier.id,
					user_id: subscription.user_id,
					targetTierPower: paidTier.power,
					paidAmount: paidAmount(paidTier),
				},
				occurredAt: canceledAt,
			},
		});

		expect(newSub.current_tier_id).to.equal(freeTier.id);
		expect(newSub.next_tier_id).to.equal(freeTier.id);
		expect(newGift).to.equal(undefined);
	});

	it('stashes active gift remainder when payment succeeds for same power tier', () => {
		const service = createService();
		const subscription = buildSubscriptionState({
			current_tier_id: paidTier.id,
			next_tier_id: paidTier.id,
			current_period_end: new Date('2024-10-01T00:00:00.000Z'),
		});

		const { newSub, newGift } = service.handlePaymentEvent({
			user: { id: subscription.user_id },
			freeTier,
			subscription: buildAggregation(subscription, { giftedTier: paidTier, giftedDaysLeft: 6 }),
			event: {
				type: 'payment.succeeded',
				meta: {
					current_tier_id: paidTier.id,
					user_id: subscription.user_id,
					targetTierPower: paidTier.power,
					paidAmount: paidAmount(paidTier),
				},
				occurredAt: new Date('2024-09-20T00:00:00.000Z'),
			},
		});

		expect(newSub.current_tier_id).to.equal(paidTier.id);
		expect(newSub.next_tier_id).to.equal(paidTier.id);
		expect(newGift).to.deep.equal({ activated_at: null, duration_days: 6 });
	});

	it('stashes active gift remainder when payment succeeds for higher power tier', () => {
		const service = createService();
		const subscription = buildSubscriptionState({
			current_tier_id: paidTier.id,
			next_tier_id: paidTier.id,
			current_period_end: new Date('2024-10-01T00:00:00.000Z'),
		});

		const { newSub, newGift } = service.handlePaymentEvent({
			user: { id: subscription.user_id },
			freeTier,
			subscription: buildAggregation(subscription, { giftedTier: paidTier, giftedDaysLeft: 6 }),
			event: {
				type: 'payment.succeeded',
				meta: {
					current_tier_id: premiumTier.id,
					user_id: subscription.user_id,
					targetTierPower: premiumTier.power,
					paidAmount: paidAmount(premiumTier),
				},
				occurredAt: new Date('2024-09-20T00:00:00.000Z'),
			},
		});

		expect(newSub.current_tier_id).to.equal(premiumTier.id);
		expect(newSub.next_tier_id).to.equal(premiumTier.id);
		expect(newGift).to.deep.equal({ activated_at: null, duration_days: 6 });
	});

	it('keeps active gift when payment succeeds for lower power tier', () => {
		const service = createService();
		const GIFTED_DAYS_LEFT = 6;
		const BILLING_DEFAULT_PERIOD = 30;

		const subscription = buildSubscriptionState({
			current_tier_id: paidTier.id,
			next_tier_id: paidTier.id,
			current_period_end: new Date('2024-10-01T00:00:00.000Z'),
			billing_period_days: BILLING_DEFAULT_PERIOD,
		});

		if (!subscription.current_period_end) {
			throw new Error('Expected paid sub to have a period end');
		}

		const { newSub, newGift } = service.handlePaymentEvent({
			user: { id: subscription.user_id },
			freeTier,
			subscription: buildAggregation(subscription, { giftedTier: premiumTier, giftedDaysLeft: GIFTED_DAYS_LEFT }),
			event: {
				type: 'payment.succeeded',
				meta: {
					current_tier_id: paidTier.id,
					user_id: subscription.user_id,
					targetTierPower: paidTier.power,
					paidAmount: paidAmount(paidTier),
				},
				occurredAt: new Date('2024-09-20T00:00:00.000Z'),
			},
		});

		expect(newSub.current_tier_id).to.equal(paidTier.id);
		expect(newSub.next_tier_id).to.equal(paidTier.id);
		expect(newSub.current_period_end?.getTime()).to.equal(
			addDays(subscription.current_period_end, BILLING_DEFAULT_PERIOD + GIFTED_DAYS_LEFT).getTime(),
		);
		expect(newGift).to.be.undefined;
		expect(newSub.price_on_purchase_rubles.toString()).to.equal(paidAmount(paidTier).value);
	});

	it('returns the same result when the same payment success event is handled twice', () => {
		const service = createService();
		const occurredAt = new Date('2024-10-15T00:00:00.000Z');
		const currentEnd = new Date('2024-10-20T00:00:00.000Z');
		const subscription = buildSubscriptionState({
			current_period_end: currentEnd,
			last_billing_attempt: addDays(occurredAt, -5),
		});

		const { newSub, newGift } = expectRepeatedHandlingToBeDeeplyEqual(service, {
			user: { id: subscription.user_id },
			freeTier,
			subscription: buildAggregation(subscription),
			event: {
				type: 'payment.succeeded',
				meta: {
					current_tier_id: subscription.current_tier_id,
					user_id: subscription.user_id,
					targetTierPower: paidTier.power,
					paidAmount: paidAmount(paidTier),
				},
				occurredAt,
			},
		});

		expect(newSub.current_period_end?.getTime()).to.equal(addDays(currentEnd, 30).getTime());
		expect(newSub.last_billing_attempt?.getTime()).to.equal(occurredAt.getTime());
		expect(newGift).to.deep.equal({ activated_at: null, duration_days: 0 });
	});

	it('returns the same result when the same lower-tier payment success with active gift is handled twice', () => {
		const service = createService();
		const occurredAt = new Date('2024-10-15T00:00:00.000Z');
		const currentEnd = new Date('2024-10-20T00:00:00.000Z');
		const giftedDaysLeft = 6;
		const subscription = buildSubscriptionState({
			current_period_end: currentEnd,
			last_billing_attempt: addDays(occurredAt, -5),
		});

		const { newSub, newGift } = expectRepeatedHandlingToBeDeeplyEqual(service, {
			user: { id: subscription.user_id },
			freeTier,
			subscription: buildAggregation(subscription, { giftedTier: premiumTier, giftedDaysLeft }),
			event: {
				type: 'payment.succeeded',
				meta: {
					current_tier_id: paidTier.id,
					user_id: subscription.user_id,
					targetTierPower: paidTier.power,
					paidAmount: paidAmount(paidTier),
				},
				occurredAt,
			},
		});

		expect(newSub.current_period_end?.getTime()).to.equal(addDays(currentEnd, 30 + giftedDaysLeft).getTime());
		expect(newSub.last_billing_attempt?.getTime()).to.equal(occurredAt.getTime());
		expect(newGift).to.be.undefined;
	});

	it('returns the same result when the same grace-period cancellation is handled twice', () => {
		const service = createService();
		const canceledAt = new Date('2024-10-05T00:00:00.000Z');
		const periodEnd = new Date('2024-10-03T00:00:00.000Z');
		const subscription = buildSubscriptionState({
			current_period_end: periodEnd,
			grace_period_size: 5,
			last_billing_attempt: addDays(canceledAt, -5),
		});

		const { newSub, newGift } = expectRepeatedHandlingToBeDeeplyEqual(service, {
			user: { id: subscription.user_id },
			freeTier,
			subscription: buildAggregation(subscription),
			event: {
				type: 'payment.canceled',
				meta: {
					current_tier_id: subscription.current_tier_id,
					user_id: subscription.user_id,
					targetTierPower: paidTier.power,
					paidAmount: paidAmount(paidTier),
				},
				occurredAt: canceledAt,
			},
		});

		expect(newSub.current_tier_id).to.equal(subscription.current_tier_id);
		expect(newSub.current_period_end?.getTime()).to.equal(periodEnd.getTime());
		expect(newSub.last_billing_attempt?.getTime()).to.equal(canceledAt.getTime());
		expect(newGift).to.be.undefined;
	});

	it('returns the same result when the same out-of-grace cancellation is handled twice', () => {
		const service = createService();
		const canceledAt = new Date('2024-10-10T00:00:00.000Z');
		const periodEnd = new Date('2024-10-01T00:00:00.000Z');
		const subscription = buildSubscriptionState({
			current_tier_id: paidTier.id,
			next_tier_id: paidTier.id,
			current_period_end: periodEnd,
			grace_period_size: 3,
			last_billing_attempt: addDays(canceledAt, -10),
		});

		const { newSub, newGift } = expectRepeatedHandlingToBeDeeplyEqual(service, {
			user: { id: subscription.user_id },
			freeTier,
			subscription: buildAggregation(subscription),
			event: {
				type: 'payment.canceled',
				meta: {
					current_tier_id: paidTier.id,
					user_id: subscription.user_id,
					targetTierPower: paidTier.power,
					paidAmount: paidAmount(paidTier),
				},
				occurredAt: canceledAt,
			},
		});

		expect(newSub.current_tier_id).to.equal(freeTier.id);
		expect(newSub.next_tier_id).to.equal(freeTier.id);
		expect(newSub.current_period_end).to.equal(null);
		expect(newSub.last_billing_attempt?.getTime()).to.equal(canceledAt.getTime());
		expect(newGift).to.be.undefined;
	});
});
