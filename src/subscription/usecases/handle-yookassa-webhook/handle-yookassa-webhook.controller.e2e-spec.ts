import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { expect } from 'chai';
import { createTestSubscriptionTier, createTestUser } from '../../../../test/fixtures/user.fixture';
import { ISharedContext } from '../../../../test/setup/test.app-setup';
import { TestHttpClient } from '../../../../test/test.http-client';
import { jwtConfig } from '../../../config';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { UsersTestRepository } from '../../../user/test-utils/test.repo';
import { NewSubscription } from '../../subscription.entity';
import { SubscriptionTestRepository } from '../../test-utils/test.repo';
import { SubscriptionTestSdk } from '../../test-utils/test.sdk';
import {
	YookassaPaymentCanceledWebhook,
	YookassaPaymentMethodActiveWebhook,
	YookassaPaymentSucceededWebhook,
	YookassaWebhookPayload,
} from '../../types/yookassa-webhook';
import { randomUUID } from 'crypto';
import { GiftTestRepository } from '../../../gift/test-utils/test.repo';
import { UserRepository } from '../../../user/user.repository';
import { expectSubscriptionIsFree } from '../../test-utils/utils';
import { SubscriptionTier } from '../../../subscription-tier/subscription-tier.entity';
import * as sinon from 'sinon';

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

type SubscriptionSeedOptions = {
	tierOverrides?: Parameters<typeof createTestSubscriptionTier>[1];
	userOverrides?: Parameters<typeof createTestUser>[1];
	subscriptionOverrides?: Partial<NewSubscription>;
	paymentMethodId?: string;
};

type PaymentEventFilter = { subscriptionId?: string };

describe('[E2E] Handle YooKassa webhook', () => {
	let app: INestApplication;

	let usersUtilRepository: UsersTestRepository;
	let userRepository: UserRepository;
	let subscriptionRepo: SubscriptionTestRepository;
	let giftRepo: GiftTestRepository;
	let subscriptionSdk: SubscriptionTestSdk;
	let freeTier: SubscriptionTier;

	before(function (this: ISharedContext) {
		app = this.app;
		const dbProvider = app.get(DatabaseProvider);
		usersUtilRepository = new UsersTestRepository(dbProvider);
		userRepository = new UserRepository(dbProvider);
		subscriptionRepo = new SubscriptionTestRepository(dbProvider);
		giftRepo = new GiftTestRepository(dbProvider);

		subscriptionSdk = new SubscriptionTestSdk(
			new TestHttpClient(
				{
					port: 3000,
					host: 'http://127.0.0.1',
				},
				app.get<ConfigType<typeof jwtConfig>>(jwtConfig.KEY),
			),
		);
	});

	beforeEach(async () => {
		freeTier = await createTestSubscriptionTier(usersUtilRepository, {
			power: 0,
			tier: 'FREE TIER BASIC',
			price_rubles: 0,
		})
	});

	afterEach(async () => {
		await giftRepo.clearAll();
		await subscriptionRepo.clearAll();
		await usersUtilRepository.clearAll();
	});

	const defaultSubscriptionFields = (): Omit<NewSubscription, 'user_id' | 'current_tier_id' | 'next_tier_id'> => ({
		price_on_purchase_rubles: 2500,
		grace_period_size: 3,
		billing_period_days: 30,
		current_period_end: new Date('2025-01-01T00:00:00.000Z'),
		last_billing_attempt: new Date('2025-01-01T00:00:00.000Z'),
	});

	const givenSubscription = async (options: SubscriptionSeedOptions = {}) => {
		const { tierOverrides, userOverrides, subscriptionOverrides, paymentMethodId } = options;
		const tier = await createTestSubscriptionTier(usersUtilRepository, { tier: 'premium', ...(tierOverrides ?? {}) });
		const user = await createTestUser(usersUtilRepository, { role: 'subscriber', ...(userOverrides ?? {}) });
		const { current_tier_id: overrideTierId, next_tier_id: overrideNextTierId, user_id: _ignoredUserId, ...restOverrides } = subscriptionOverrides ?? {};

		const subscriptionToInsert: NewSubscription = {
			user_id: user.id,
			current_tier_id: overrideTierId ?? tier.id,
			next_tier_id: overrideNextTierId ?? overrideTierId ?? tier.id,
			...defaultSubscriptionFields(),
			...restOverrides,
		};
		const subscription = await subscriptionRepo.insert(subscriptionToInsert);
		if (paymentMethodId) {
			await subscriptionRepo.addActivePaymentMethod({
				userId: user.id,
				paymentMethodId,
			});
		}
		return { user, subscription, tier };
	};

	const sendWebhook = async (payload: YookassaWebhookPayload) => {
		const response = await subscriptionSdk.sendYookassaWebhook({
			params: payload,
			userMeta: { isAuth: false },
		});
		expect(response.status).to.equal(HttpStatus.OK);
	};

	const expectStoredEvent = async (payload: YookassaWebhookPayload, filter: PaymentEventFilter = {}) => {
		const events = await subscriptionRepo.findPaymentEvents(filter);
		expect(events.length).to.equal(1);
		expect(events[0].event).to.deep.equal(payload);
		return events[0];
	};

	const findSubscriptionOrFail = async (id: string, errorMessage = 'Subscription missing after webhook') => {
		const subscription = await subscriptionRepo.findById(id);
		expect(subscription).to.not.be.a('undefined');
		if (!subscription) {
			throw new Error(errorMessage);
		}
		return subscription;
	};

	const expectPaymentMethodId = async (userId: string, paymentMethodId: string) => {
		const paymentMethod = await subscriptionRepo.findPaymentMethod(userId);
		expect(paymentMethod?.payment_method_id).to.equal(paymentMethodId);
	};

	it('stores unsupported webhook event without processing and responds with 200', async () => {
		const user_id = randomUUID();
		const current_tier_id = randomUUID();

		const rawPayload = {
			event: 'payment.waiting_for_capture',
			object: {
				id: 'payment-ignored-001',
				status: 'waiting_for_capture',
				paid: false,
				amount: {
					value: '300.00',
					currency: 'RUB',
				},
				created_at: new Date('2025-02-01T12:00:00.000Z').toISOString(),
				metadata: {
					user_id,
					current_tier_id,
				},
			},
		};

		const payload = rawPayload as unknown as YookassaWebhookPayload;
		await sendWebhook(payload);

		const event = await expectStoredEvent(payload);
		expect(event.subscription_id).to.equal(null);
		expect(event.user_id).to.equal(null);
	});

	it('stores unsupported webhook event without processing and responds with 200 even without metadata', async () => {
		const rawPayload = {
			event: 'payment.non_existend_event',
			object: {
				paid: false,
				created_at: new Date('2025-02-01T12:00:00.000Z').toISOString(),
			},
		};

		const payload = rawPayload as unknown as YookassaWebhookPayload;
		await sendWebhook(payload);

		const event = await expectStoredEvent(payload);
		expect(event.subscription_id).to.equal(null);
		expect(event.user_id).to.equal(null);
	});

	it('stores duplicate unsupported webhook deliveries', async () => {
		const rawPayload = {
			event: 'payment.waiting_for_capture',
			object: {
				id: 'payment-ignored-duplicate-001',
				status: 'waiting_for_capture',
				paid: false,
				amount: {
					value: '300.00',
					currency: 'RUB',
				},
				created_at: new Date('2025-02-01T12:00:00.000Z').toISOString(),
			},
		};

		const payload = rawPayload as unknown as YookassaWebhookPayload;
		await sendWebhook(payload);
		await sendWebhook(payload);

		const events = await subscriptionRepo.findPaymentEvents();
		expect(events).to.have.length(2);
		expect(events.every(event => event.subscription_id === null)).to.equal(true);
		expect(events.every(event => event.user_id === null)).to.equal(true);
	});

	it('stores payment success event and prolongs subscription', async () => {
		const currentPeriodEnd = new Date('2025-01-05T00:00:00.000Z');
		const billingPeriodDays = 30;

		const { user, subscription } = await givenSubscription({
			tierOverrides: { tier: 'premium' },
			subscriptionOverrides: {
				price_on_purchase_rubles: 2500,
				grace_period_size: 3,
				billing_period_days: billingPeriodDays,
				current_period_end: currentPeriodEnd,
				last_billing_attempt: new Date('2024-12-01T00:00:00.000Z'),
			},
			paymentMethodId: 'pm-123',
		});

		const occurredAt = new Date('2024-12-15T12:00:00.000Z');
		const payload: YookassaPaymentSucceededWebhook = {
			event: 'payment.succeeded',
			object: {
				id: 'payment-001',
				status: 'succeeded',
				paid: true,
				amount: {
					value: '200.00',
					currency: 'RUB',
				},
				metadata: {
					user_id: user.id,
					current_tier_id: subscription.current_tier_id,
				},
				created_at: occurredAt.toISOString(),
				payment_method: {
					id: 'pm-123',
					type: 'bank_card',
					saved: true,
					card: { last4: '4242' },
				},
			},
		};

		await sendWebhook(payload);

		const updatedSubscription = await findSubscriptionOrFail(subscription.id, 'Subscription missing after webhook');

		const expectedEnd = addDays(currentPeriodEnd, billingPeriodDays);
		expect(updatedSubscription.current_period_end?.getTime()).to.equal(expectedEnd.getTime());
		expect(updatedSubscription.last_billing_attempt?.getTime()).to.equal(occurredAt.getTime());
		expect(updatedSubscription.current_tier_id).to.equal(subscription.current_tier_id);
		expect(updatedSubscription.next_tier_id).to.equal(subscription.next_tier_id);
		await expectPaymentMethodId(user.id, 'pm-123');

		await expectStoredEvent(payload, { subscriptionId: subscription.id });
	});

	it('skips duplicate supported webhook delivery without storing or processing it again', async () => {
		const currentPeriodEnd = new Date('2025-01-05T00:00:00.000Z');
		const billingPeriodDays = 30;

		const { user, subscription } = await givenSubscription({
			tierOverrides: { tier: 'premium' },
			subscriptionOverrides: {
				price_on_purchase_rubles: 2500,
				grace_period_size: 3,
				billing_period_days: billingPeriodDays,
				current_period_end: currentPeriodEnd,
				last_billing_attempt: new Date('2024-12-01T00:00:00.000Z'),
			},
			paymentMethodId: 'pm-deduped',
		});

		const occurredAt = new Date('2024-12-15T12:00:00.000Z');
		const payload: YookassaPaymentSucceededWebhook = {
			event: 'payment.succeeded',
			object: {
				id: 'payment-deduped-001',
				status: 'succeeded',
				paid: true,
				amount: {
					value: '200.00',
					currency: 'RUB',
				},
				metadata: {
					user_id: user.id,
					current_tier_id: subscription.current_tier_id,
				},
				created_at: occurredAt.toISOString(),
				payment_method: {
					id: 'pm-deduped',
					type: 'bank_card',
					saved: true,
					card: { last4: '4242' },
				},
			},
		};

		const expectedEnd = addDays(currentPeriodEnd, billingPeriodDays);

		await sendWebhook(payload);

		const subscriptionAfterFirstCall = await findSubscriptionOrFail(subscription.id, 'Subscription missing after webhook');
		expect(subscriptionAfterFirstCall.current_period_end?.getTime()).to.equal(expectedEnd.getTime());
		expect(subscriptionAfterFirstCall.last_billing_attempt?.getTime()).to.equal(occurredAt.getTime());

		const redeliveryAt = addDays(occurredAt, 10);
		const clock = sinon.useFakeTimers({
			now: redeliveryAt.getTime(),
			shouldClearNativeTimers: true,
			toFake: ['Date'],
		});

		try {
			await sendWebhook(payload);
		} finally {
			clock.restore();
		}

		const subscriptionAfterSecondCall = await findSubscriptionOrFail(subscription.id, 'Subscription missing after webhook');
		expect(subscriptionAfterSecondCall.current_period_end?.getTime()).to.equal(expectedEnd.getTime());
		expect(subscriptionAfterSecondCall.last_billing_attempt?.getTime()).to.equal(occurredAt.getTime());

		expect(subscriptionAfterSecondCall.current_period_end?.getTime()).to.equal(subscriptionAfterFirstCall.current_period_end?.getTime());
		expect(subscriptionAfterSecondCall.last_billing_attempt?.getTime()).to.equal(subscriptionAfterFirstCall?.last_billing_attempt?.getTime());

		const events = await subscriptionRepo.findPaymentEvents({ subscriptionId: subscription.id });
		expect(events).to.have.length(1);
		expect(events[0].event).to.deep.equal(payload);
	});

	it('prolongs subscription when payment succeeds after period end but within grace window', async () => {
		const originalEnd = new Date('2024-08-01T00:00:00.000Z');
		const now = new Date('2024-08-04T10:00:00.000Z');

		const { user, subscription } = await givenSubscription({
			tierOverrides: { tier: 'premium' },
			subscriptionOverrides: {
				price_on_purchase_rubles: 2500,
				grace_period_size: 5,
				billing_period_days: 30,
				current_period_end: originalEnd,
				last_billing_attempt: addDays(originalEnd, 1),
			},
			paymentMethodId: 'pm-777',
		});

		const payload: YookassaPaymentSucceededWebhook = {
			event: 'payment.succeeded',
			object: {
				id: 'payment-extend-after-grace',
				status: 'succeeded',
				paid: true,
				amount: {
					value: '2500.00',
					currency: 'RUB',
				},
				metadata: {
					user_id: user.id,
					current_tier_id: subscription.current_tier_id,
				},
				created_at: now.toISOString(),
				payment_method: {
					id: 'pm-777',
					type: 'bank_card',
					saved: true,
				},
			},
		};

		await sendWebhook(payload);

		const updatedSubscription = await findSubscriptionOrFail(subscription.id, 'Subscription missing after webhook');

		const expectedEnd = addDays(now, 30);
		expect(updatedSubscription.current_period_end?.getTime()).to.equal(expectedEnd.getTime());
		expect(updatedSubscription.last_billing_attempt?.getTime()).to.equal(now.getTime());
		expect(updatedSubscription.current_tier_id).to.equal(subscription.current_tier_id);
		expect(updatedSubscription.next_tier_id).to.equal(subscription.next_tier_id);

		await expectStoredEvent(payload, { subscriptionId: subscription.id });
	});

	it('stores payment method when payment_method.active webhook is received', async () => {
		const { user } = await givenSubscription({
			tierOverrides: { tier: 'premium' },
			subscriptionOverrides: {
				price_on_purchase_rubles: 2500,
				grace_period_size: 3,
				billing_period_days: 30,
				current_period_end: new Date('2025-02-01T00:00:00.000Z'),
				last_billing_attempt: new Date('2025-01-01T00:00:00.000Z'),
			},
		});

		await subscriptionRepo.addActivePaymentMethod({
			userId: user.id,
			paymentMethodId: 'pm-old-active',
		});

		await subscriptionRepo.addPendingPaymentMethod({
			userId: user.id,
			paymentMethodId: 'pm-from-active-webhook',
		});

		const payload: YookassaPaymentMethodActiveWebhook = {
			event: 'payment_method.active',
			object: {
				id: 'pm-from-active-webhook',
				type: 'bank_card',
				status: 'active',
				saved: true,
				card: { last4: '5555' },
			},
		};

		await sendWebhook(payload);

		const storedPaymentMethod = await subscriptionRepo.findPaymentMethod(user.id);
		expect(storedPaymentMethod?.payment_method_id).to.equal('pm-from-active-webhook');
		expect(storedPaymentMethod?.status).to.equal('active');

		const paymentMethods = await subscriptionRepo.findPaymentMethods(user.id);
		expect(paymentMethods).to.have.length(1);
		expect(paymentMethods[0].payment_method_id).to.equal('pm-from-active-webhook');
		expect(paymentMethods[0].status).to.equal('active');

		const storedEvent = await expectStoredEvent(payload);
		expect(storedEvent.user_id).to.equal(user.id);
		expect(storedEvent.subscription_id).to.equal(null);
	});

	it('stores payment success event and switches subscription to cheaper tier from metadata when was on subscription without gifts', async () => {
		const standardTier = await createTestSubscriptionTier(usersUtilRepository, { tier: 'standard', power: 1 });
		const currentPeriodEnd = new Date('2025-04-10T00:00:00.000Z');

		const {
			user,
			subscription,
			tier: premiumTier,
		} = await givenSubscription({
			tierOverrides: { tier: 'premium', power: 2 },
			subscriptionOverrides: {
				price_on_purchase_rubles: 3500,
				grace_period_size: 3,
				billing_period_days: 30,
				current_period_end: currentPeriodEnd,
				last_billing_attempt: new Date('2025-03-10T00:00:00.000Z'),
			},
			paymentMethodId: 'pm-234',
		});

		expect(standardTier.power).to.be.lessThan(premiumTier.power);
		expect(subscription.current_tier_id).to.equal(premiumTier.id);

		const occurredAt = new Date('2025-03-15T12:00:00.000Z');
		const payload: YookassaPaymentSucceededWebhook = {
			event: 'payment.succeeded',
			object: {
				id: 'payment-010',
				status: 'succeeded',
				paid: true,
				amount: {
					value: '1200.00',
					currency: 'RUB',
				},
				metadata: {
					user_id: user.id,
					current_tier_id: standardTier.id,
				},
				created_at: occurredAt.toISOString(),
			},
		};

		await sendWebhook(payload);

		const updatedSubscription = await findSubscriptionOrFail(subscription.id, 'Subscription missing after webhook');

		const expectedEnd = addDays(currentPeriodEnd, 30);
		expect(updatedSubscription.current_period_end?.getTime()).to.equal(expectedEnd.getTime());
		expect(updatedSubscription.last_billing_attempt?.getTime()).to.equal(occurredAt.getTime());
		expect(updatedSubscription.current_tier_id).to.equal(standardTier.id);
		expect(updatedSubscription.next_tier_id).to.equal(standardTier.id);
		expect(updatedSubscription.current_tier_id).to.not.equal(premiumTier.id);

		await expectStoredEvent(payload, { subscriptionId: subscription.id });
		await expectPaymentMethodId(user.id, 'pm-234');
	});

	it('stores payment success event and switches subscription to more expensive tier from metadata when was on subscription without gifts', async () => {
		const vipTier = await createTestSubscriptionTier(usersUtilRepository, { tier: 'vip', power: 3 });
		const currentPeriodEnd = new Date('2025-05-10T00:00:00.000Z');

		const {
			user,
			subscription,
			tier: standardTier,
		} = await givenSubscription({
			tierOverrides: { tier: 'standard', power: 1 },
			subscriptionOverrides: {
				price_on_purchase_rubles: 1200,
				grace_period_size: 3,
				billing_period_days: 30,
				current_period_end: currentPeriodEnd,
				last_billing_attempt: new Date('2025-04-10T00:00:00.000Z'),
			},
			paymentMethodId: 'pm-345',
		});

		expect(standardTier.power).to.be.lessThan(vipTier.power);

		const occurredAt = new Date('2025-04-20T12:00:00.000Z');
		const payload: YookassaPaymentSucceededWebhook = {
			event: 'payment.succeeded',
			object: {
				id: 'payment-011',
				status: 'succeeded',
				paid: true,
				amount: {
					value: '5200.00',
					currency: 'RUB',
				},
				metadata: {
					user_id: user.id,
					current_tier_id: vipTier.id,
				},
				created_at: occurredAt.toISOString(),
			},
		};

		await sendWebhook(payload);

		const updatedSubscription = await findSubscriptionOrFail(subscription.id, 'Subscription missing after webhook');

		const expectedEnd = addDays(currentPeriodEnd, 30);
		expect(updatedSubscription.current_period_end?.getTime()).to.equal(expectedEnd.getTime());
		expect(updatedSubscription.last_billing_attempt?.getTime()).to.equal(occurredAt.getTime());
		expect(updatedSubscription.current_tier_id).to.equal(vipTier.id);
		expect(updatedSubscription.next_tier_id).to.equal(vipTier.id);
		expect(updatedSubscription.current_tier_id).to.not.equal(standardTier.id);

		await expectStoredEvent(payload, { subscriptionId: subscription.id });
		await expectPaymentMethodId(user.id, 'pm-345');
	});

	it('stores payment success event and switches subscription to tier with more power from metadata when currently subscriber was on gifted sub with lower power. Rest of gift is stashed away', async () => {
		const paidTier = await createTestSubscriptionTier(usersUtilRepository, { tier: 'paid', power: 2, price_rubles: 2000 });
		const giftTier = await createTestSubscriptionTier(usersUtilRepository, { tier: 'gift-low', power: 3, price_rubles: 3000 });
		const vipTier = await createTestSubscriptionTier(usersUtilRepository, { tier: 'vip', power: 5, price_rubles: 5000 });
		const currentPeriodEnd = new Date('2025-06-10T00:00:00.000Z');

		const { user, subscription } = await givenSubscription({
			subscriptionOverrides: {
				current_tier_id: paidTier.id,
				next_tier_id: paidTier.id,
				price_on_purchase_rubles: paidTier.price_rubles,
				billing_period_days: 30,
				current_period_end: currentPeriodEnd,
				last_billing_attempt: new Date('2025-05-10T00:00:00.000Z'),
			},
			paymentMethodId: 'pm-gift-low',
		});

		expect(subscription.current_tier_id).to.equal(paidTier.id);
		expect(subscription.next_tier_id).to.equal(paidTier.id);

		const activatedAt = addDays(new Date(), -5);
		const gift = await giftRepo.insertGift({
			gifted_by: user.id,
			gifted_to: user.id,
			tier_id: giftTier.id,
			duration_days: 20,
			activated_at: activatedAt,
		});

		const occurredAt = new Date('2025-05-20T12:00:00.000Z');
		const payload: YookassaPaymentSucceededWebhook = {
			event: 'payment.succeeded',
			object: {
				id: 'payment-gift-low-to-vip',
				status: 'succeeded',
				paid: true,
				amount: { value: '5000.00', currency: 'RUB' },
				metadata: { user_id: user.id, current_tier_id: vipTier.id },
				created_at: occurredAt.toISOString(),
			},
		};

		await sendWebhook(payload);

		const updatedSubscription = await findSubscriptionOrFail(subscription.id);
		expect(updatedSubscription.current_tier_id).to.equal(vipTier.id);
		expect(updatedSubscription.next_tier_id).to.equal(vipTier.id);
		expect(updatedSubscription.current_period_end?.getTime()).to.equal(addDays(currentPeriodEnd, 30).getTime());

		const stashedGift = await giftRepo.getByFields({ giftedBy: user.id, giftedTo: user.id, tierId: giftTier.id });
		expect(stashedGift?.id).to.equal(gift.id);
		expect(stashedGift?.activated_at).to.equal(null);
		expect(stashedGift?.duration_days).to.be.greaterThan(0);
		expect(stashedGift?.duration_days).to.be.lessThanOrEqual(20);

		await expectStoredEvent(payload, { subscriptionId: subscription.id });
	});

	it('stores payment success event and switches subscription to paid one from metadata when currently subscriber was on gifted subscription of same tier power. Rest of gift is stashed away', async () => {
		const paidTier = await createTestSubscriptionTier(usersUtilRepository, { tier: 'paid-same-power', power: 4, price_rubles: 4000 });
		const currentPeriodEnd = new Date('2025-07-10T00:00:00.000Z');

		const { user, subscription } = await givenSubscription({
			subscriptionOverrides: {
				current_tier_id: paidTier.id,
				next_tier_id: paidTier.id,
				price_on_purchase_rubles: paidTier.price_rubles,
				billing_period_days: 30,
				current_period_end: currentPeriodEnd,
				last_billing_attempt: new Date('2025-06-10T00:00:00.000Z'),
			},
			paymentMethodId: 'pm-gift-same',
		});

		const gift = await giftRepo.insertGift({
			gifted_by: user.id,
			gifted_to: user.id,
			tier_id: paidTier.id,
			duration_days: 15,
			activated_at: addDays(new Date(), -3),
		});

		const occurredAt = new Date('2025-06-20T12:00:00.000Z');
		const payload: YookassaPaymentSucceededWebhook = {
			event: 'payment.succeeded',
			object: {
				id: 'payment-gift-same-to-paid',
				status: 'succeeded',
				paid: true,
				amount: { value: '4000.00', currency: 'RUB' },
				metadata: { user_id: user.id, current_tier_id: paidTier.id },
				created_at: occurredAt.toISOString(),
			},
		};

		await sendWebhook(payload);

		const updatedSubscription = await findSubscriptionOrFail(subscription.id);
		expect(updatedSubscription.current_tier_id).to.equal(paidTier.id);
		expect(updatedSubscription.next_tier_id).to.equal(paidTier.id);
		expect(updatedSubscription.current_period_end?.getTime()).to.equal(addDays(currentPeriodEnd, 30).getTime());

		const stashedGift = await giftRepo.getByFields({ giftedBy: user.id, giftedTo: user.id, tierId: paidTier.id });
		expect(stashedGift?.id).to.equal(gift.id);
		expect(stashedGift?.activated_at).to.equal(null);
		expect(stashedGift?.duration_days).to.be.greaterThan(0);
		expect(stashedGift?.duration_days).to.be.lessThanOrEqual(15);

		await expectStoredEvent(payload, { subscriptionId: subscription.id });
	});

	it('when user is on free tier with gifted sub of tier 1 but the payment event for tier 2 comes, he gets tier 2 and rest of the gift is stashed away', async () => {
		const freeTier = await createTestSubscriptionTier(usersUtilRepository, { tier: 'free', power: 0, price_rubles: 2000 });
		const giftTier = await createTestSubscriptionTier(usersUtilRepository, { tier: 'gift-low', power: 3, price_rubles: 3000 });
		const vipTier = await createTestSubscriptionTier(usersUtilRepository, { tier: 'vip', power: 5, price_rubles: 5000 });

		const { user, subscription } = await givenSubscription({
			subscriptionOverrides: {
				current_tier_id: freeTier.id,
				next_tier_id: freeTier.id,
				price_on_purchase_rubles: freeTier.price_rubles,
				billing_period_days: 0,
				current_period_end: null,
				last_billing_attempt: null,
			},
			paymentMethodId: 'pm-gift-low',
		});

		const activatedAt = addDays(new Date(), -5);
		const gift = await giftRepo.insertGift({
			gifted_by: user.id,
			gifted_to: user.id,
			tier_id: giftTier.id,
			duration_days: 20,
			activated_at: activatedAt,
		});

		const occurredAt = new Date('2025-05-20T12:00:00.000Z');
		const payload: YookassaPaymentSucceededWebhook = {
			event: 'payment.succeeded',
			object: {
				id: 'payment-gift-low-to-vip',
				status: 'succeeded',
				paid: true,
				amount: { value: '5000.00', currency: 'RUB' },
				metadata: { user_id: user.id, current_tier_id: vipTier.id },
				created_at: occurredAt.toISOString(),
			},
		};

		await sendWebhook(payload);

		const updatedSubscription = await findSubscriptionOrFail(subscription.id);
		expect(updatedSubscription.current_tier_id).to.equal(vipTier.id);
		expect(updatedSubscription.next_tier_id).to.equal(vipTier.id);
		expect(updatedSubscription.current_period_end?.getTime()).to.equal(addDays(occurredAt, 30).getTime());

		const stashedGift = await giftRepo.getByFields({ giftedBy: user.id, giftedTo: user.id, tierId: giftTier.id });
		expect(stashedGift?.id).to.equal(gift.id);
		expect(stashedGift?.activated_at).to.equal(null);
		expect(stashedGift?.duration_days).to.be.greaterThan(0);
		expect(stashedGift?.duration_days).to.be.lessThanOrEqual(20);

		await expectStoredEvent(payload, { subscriptionId: subscription.id });
	});

	it('when user has a current gifted sub with tier 2 but next_tier_id is 1 after the webhook is processed his current_tier_id should be pointing to tier 1 but user view shows active tier 2 gift and billing date includes gift remainder plus paid period', async () => {
		const tier1 = await createTestSubscriptionTier(usersUtilRepository, { tier: 'tier-1-gift', power: 1, price_rubles: 1000 });
		const tier2 = await createTestSubscriptionTier(usersUtilRepository, { tier: 'tier-2-gift', power: 2, price_rubles: 2000 });
		const currentPeriodEnd = new Date('2025-09-01T00:00:00.000Z');
		const giftDurationDays = 10;

		const { user, subscription } = await givenSubscription({
			subscriptionOverrides: {
				current_tier_id: tier1.id,
				next_tier_id: tier1.id,
				price_on_purchase_rubles: tier1.price_rubles,
				billing_period_days: 30,
				current_period_end: currentPeriodEnd,
			},
			paymentMethodId: 'pm-next-tier-1-with-gift',
		});

		const now = new Date();
		const twoDaysAgo = addDays(now, -2);

		await giftRepo.insertGift({
			gifted_by: user.id,
			gifted_to: user.id,
			tier_id: tier2.id,
			duration_days: giftDurationDays,
			activated_at: twoDaysAgo,
		});

		const payload: YookassaPaymentSucceededWebhook = {
			event: 'payment.succeeded',
			object: {
				id: 'payment-next-tier-1-with-gift',
				status: 'succeeded',
				paid: true,
				amount: { value: '1000.00', currency: 'RUB' },
				metadata: { user_id: user.id, current_tier_id: tier1.id },
				created_at: new Date('2025-08-15T12:00:00.000Z').toISOString(),
			},
		};

		await sendWebhook(payload);

		const updatedSubscription = await findSubscriptionOrFail(subscription.id);
		expect(updatedSubscription.current_tier_id).to.equal(tier1.id);
		expect(updatedSubscription.next_tier_id).to.equal(tier1.id);
		expect(updatedSubscription.current_period_end?.getTime()).to.equal(
			addDays(currentPeriodEnd, 30 + giftDurationDays - 2).getTime(),
		);

		const userWithSubscription = await userRepository.findByIdWithSubscriptionTier(user.id);
		expect(userWithSubscription?.subscription?.current_tier_id).to.equal(tier2.id);
		expect(userWithSubscription?.subscription_tier?.id).to.equal(tier2.id);
		expect(userWithSubscription?.subscription?.current_period_end?.getTime()).to.equal(
			addDays(currentPeriodEnd, 30 + giftDurationDays - 2).getTime(),
		);

		await expectStoredEvent(payload, { subscriptionId: subscription.id });
	});

	it('keeps subscription active and updates last billing attempt when payment fails before current period end', async () => {
		const now = new Date('2024-05-01T12:00:00.000Z');
		const currentPeriodEnd = addDays(now, 5);

		const {
			user,
			subscription,
			tier: premiumTier,
		} = await givenSubscription({
			tierOverrides: { tier: 'premium' },
			subscriptionOverrides: {
				price_on_purchase_rubles: 2500,
				grace_period_size: 2,
				billing_period_days: 30,
				current_period_end: currentPeriodEnd,
				last_billing_attempt: null,
			},
			paymentMethodId: 'pm-555',
		});

		const payload: YookassaPaymentCanceledWebhook = {
			event: 'payment.canceled',
			object: {
				id: 'payment-failure-before-end',
				status: 'canceled',
				paid: false,
				amount: {
					value: '2500.00',
					currency: 'RUB',
				},
				metadata: {
					user_id: user.id,
					current_tier_id: subscription.current_tier_id,
				},
				created_at: now.toISOString(),
				canceled_at: now.toISOString(),
			},
		};

		await sendWebhook(payload);

		const updatedSubscription = await findSubscriptionOrFail(
			subscription.id,
			'Subscription missing after payment failure',
		);
		expect(updatedSubscription.current_tier_id).to.equal(premiumTier.id);
		expect(updatedSubscription.current_period_end?.getTime()).to.equal(currentPeriodEnd.getTime());
		expect(updatedSubscription.last_billing_attempt?.getTime()).to.equal(now.getTime());

		await expectStoredEvent(payload, { subscriptionId: subscription.id });
	});

	it('stores cancellation event and downgrades subscription to free tier outside grace period', async () => {
		const createdAt = new Date('2025-01-20T07:00:00.000Z');
		const canceledAt = new Date('2025-01-20T08:00:00.000Z');

		const {
			user,
			subscription,
			tier: premiumTier,
		} = await givenSubscription({
			tierOverrides: { tier: 'premium', power: 5 },
			subscriptionOverrides: {
				price_on_purchase_rubles: 2500,
				grace_period_size: 2,
				billing_period_days: 30,
				current_period_end: new Date('2025-01-15T00:00:00.000Z'),
				last_billing_attempt: new Date('2025-01-15T00:00:00.000Z'),
			},
			paymentMethodId: 'pm-456',
		});

		expect(freeTier.id).to.not.equal(premiumTier.id);

		const payload: YookassaPaymentCanceledWebhook = {
			event: 'payment.canceled',
			object: {
				id: 'payment-002',
				status: 'canceled',
				paid: false,
				amount: {
					value: '200.00',
					currency: 'RUB',
				},
				metadata: {
					user_id: user.id,
					current_tier_id: subscription.current_tier_id,
				},
				created_at: canceledAt.toISOString(),
				canceled_at: createdAt.toISOString(),
			},
		};

		await sendWebhook(payload);

		const downgradedSubscription = await findSubscriptionOrFail(
			subscription.id,
			'Subscription missing after downgrade',
		);
		expectSubscriptionIsFree(downgradedSubscription, freeTier, canceledAt);

		const event = await expectStoredEvent(payload);
		expect(event.subscription_id).to.equal(subscription.id);

		await expectPaymentMethodId(user.id, 'pm-456');
	});

	it('stores cancellation event and downgrades paid subscription to free tier outside grace period but gifted sub stays same', async () => {
		const createdAt = new Date('2025-01-20T07:00:00.000Z');
		const canceledAt = new Date('2025-01-20T08:00:00.000Z');
		const giftDurationDays = 10;

		const {
			user,
			subscription,
			tier: premiumTier,
		} = await givenSubscription({
			tierOverrides: { tier: 'premium', power: 5 },
			subscriptionOverrides: {
				price_on_purchase_rubles: 2500,
				grace_period_size: 2,
				billing_period_days: 30,
				current_period_end: new Date('2025-01-15T00:00:00.000Z'),
				last_billing_attempt: new Date('2025-01-15T00:00:00.000Z'),
			},
			paymentMethodId: 'pm-456',
		});

		const now = new Date();
		const twoDaysAgo = addDays(now, -2);

		await giftRepo.insertGift({
			gifted_by: user.id,
			gifted_to: user.id,
			tier_id: premiumTier.id,
			duration_days: giftDurationDays,
			activated_at: twoDaysAgo,
		});

		expect(freeTier.id).to.not.equal(premiumTier.id);

		const payload: YookassaPaymentCanceledWebhook = {
			event: 'payment.canceled',
			object: {
				id: 'payment-002',
				status: 'canceled',
				paid: false,
				amount: {
					value: '200.00',
					currency: 'RUB',
				},
				metadata: {
					user_id: user.id,
					current_tier_id: premiumTier.id,
				},
				created_at: canceledAt.toISOString(),
				canceled_at: createdAt.toISOString(),
			},
		};

		await sendWebhook(payload);

		const downgradedSubscription = await findSubscriptionOrFail(
			subscription.id,
			'Subscription missing after downgrade',
		);

		expectSubscriptionIsFree(downgradedSubscription, freeTier, canceledAt);

		const event = await expectStoredEvent(payload);
		expect(event.subscription_id).to.equal(subscription.id);

		await expectPaymentMethodId(user.id, 'pm-456');

		const userSubInView = await userRepository.findByIdWithSubscriptionTier(user.id);
		expect(userSubInView?.subscription?.current_tier_id).to.equal(premiumTier.id);
		expect(userSubInView?.subscription?.next_tier_id).to.equal(freeTier.id);
		expect(userSubInView?.subscription?.is_gifted).to.be.true;
		expect(userSubInView?.subscription_tier?.id).to.equal(premiumTier.id);
		expect(userSubInView?.subscription?.current_period_end).to.be.null;
	});

	it('does not downgrade subscription to free tier if payment failed within grace period', async () => {
		const freeTier = await createTestSubscriptionTier(usersUtilRepository, { tier: 'free', power: 0 });
		const createdAt = new Date('2025-01-20T07:00:00.000Z');
		const canceledAt = new Date('2025-03-12T12:00:00.000Z');

		const {
			user,
			subscription,
			tier: premiumTier,
		} = await givenSubscription({
			tierOverrides: { tier: 'premium', power: 1 },
			subscriptionOverrides: {
				price_on_purchase_rubles: 2500,
				grace_period_size: 5,
				billing_period_days: 30,
				current_period_end: new Date('2025-03-10T00:00:00.000Z'),
				last_billing_attempt: new Date('2025-02-10T00:00:00.000Z'),
			},
			paymentMethodId: 'pm-789',
		});

		expect(freeTier.id).to.not.equal(premiumTier.id);

		const payload: YookassaPaymentCanceledWebhook = {
			event: 'payment.canceled',
			object: {
				id: 'payment-003',
				status: 'canceled',
				paid: false,
				amount: {
					value: '200.00',
					currency: 'RUB',
				},
				metadata: {
					user_id: user.id,
					current_tier_id: subscription.current_tier_id,
				},
				created_at: canceledAt.toISOString(),
				canceled_at: createdAt.toISOString(),
			},
		};

		await sendWebhook(payload);

		const updatedSubscription = await findSubscriptionOrFail(subscription.id, 'Subscription missing after webhook');
		expect(updatedSubscription.current_tier_id).to.equal(premiumTier.id);
		expect(updatedSubscription.current_tier_id).to.not.equal(freeTier.id);
		expect(updatedSubscription.billing_period_days).to.equal(subscription.billing_period_days);
		expect(updatedSubscription.current_period_end?.getTime()).to.equal(subscription.current_period_end?.getTime());
		expect(updatedSubscription.last_billing_attempt?.getTime()).to.equal(canceledAt.getTime());

		const event = await expectStoredEvent(payload, { subscriptionId: subscription.id });
		expect(event.subscription_id).to.equal(subscription.id);

		await expectPaymentMethodId(user.id, 'pm-789');
	});
});
