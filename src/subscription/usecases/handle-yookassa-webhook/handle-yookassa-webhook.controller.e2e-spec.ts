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

	let usersRepo: UsersTestRepository;
	let subscriptionRepo: SubscriptionTestRepository;
	let subscriptionSdk: SubscriptionTestSdk;

	before(function (this: ISharedContext) {
		app = this.app;
		const dbProvider = app.get(DatabaseProvider);
		usersRepo = new UsersTestRepository(dbProvider);
		subscriptionRepo = new SubscriptionTestRepository(dbProvider);

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

	afterEach(async () => {
		await subscriptionRepo.clearAll();
		await usersRepo.clearAll();
	});

	const defaultSubscriptionFields = (): Omit<NewSubscription, 'user_id' | 'subscription_tier_id'> => ({
		price_on_purchase_rubles: 2500,
		is_gifted: false,
		grace_period_size: 3,
		billing_period_days: 30,
		current_period_end: new Date('2025-01-01T00:00:00.000Z'),
		last_billing_attempt: new Date('2025-01-01T00:00:00.000Z'),
	});

	const givenSubscription = async (options: SubscriptionSeedOptions = {}) => {
		const { tierOverrides, userOverrides, subscriptionOverrides, paymentMethodId } = options;
		const tier = await createTestSubscriptionTier(usersRepo, { tier: 'premium', ...(tierOverrides ?? {}) });
		const user = await createTestUser(usersRepo, { role: 'subscriber', ...(userOverrides ?? {}) });
		const {
			subscription_tier_id: overrideTierId,
			user_id: _ignoredUserId,
			...restOverrides
		} = subscriptionOverrides ?? {};
		const subscriptionToInsert: NewSubscription = {
			user_id: user.id,
			subscription_tier_id: overrideTierId ?? tier.id,
			...defaultSubscriptionFields(),
			...restOverrides,
		};
		const subscription = await subscriptionRepo.insert(subscriptionToInsert);
		if (paymentMethodId) {
			await subscriptionRepo.upsertPaymentMethod({
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
		const subscription_tier_id = randomUUID();

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
					subscription_tier_id,
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

	it('stores payment success event and prolongs subscription', async () => {
		const currentPeriodEnd = new Date('2025-01-05T00:00:00.000Z');
		const billingPeriodDays = 30;

		const { user, subscription } = await givenSubscription({
			tierOverrides: { tier: 'premium' },
			subscriptionOverrides: {
				price_on_purchase_rubles: 2500,
				is_gifted: false,
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
					subscription_tier_id: subscription.subscription_tier_id,
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
		await expectPaymentMethodId(user.id, 'pm-123');

		await expectStoredEvent(payload, { subscriptionId: subscription.id });
	});

	it('prolongs subscription when payment succeeds after period end but within grace window', async () => {
		const originalEnd = new Date('2024-08-01T00:00:00.000Z');
		const now = new Date('2024-08-04T10:00:00.000Z');

		const { user, subscription } = await givenSubscription({
			tierOverrides: { tier: 'premium' },
			subscriptionOverrides: {
				price_on_purchase_rubles: 2500,
				is_gifted: false,
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
					subscription_tier_id: subscription.subscription_tier_id,
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

		await expectStoredEvent(payload, { subscriptionId: subscription.id });
	});

	it('stores payment method if present in webhook', async () => {
		const { user, subscription } = await givenSubscription({
			tierOverrides: { tier: 'premium' },
			subscriptionOverrides: {
				price_on_purchase_rubles: 2500,
				is_gifted: false,
				grace_period_size: 3,
				billing_period_days: 30,
				current_period_end: new Date('2025-02-01T00:00:00.000Z'),
				last_billing_attempt: new Date('2025-01-01T00:00:00.000Z'),
			},
		});

		const before = await subscriptionRepo.findPaymentMethod(user.id);
		expect(before).to.be.a('undefined');

		const occurredAt = new Date('2025-01-15T10:00:00.000Z');
		const payload: YookassaPaymentSucceededWebhook = {
			event: 'payment.succeeded',
			object: {
				id: 'payment-store-method-001',
				status: 'succeeded',
				paid: true,
				amount: {
					value: '2500.00',
					currency: 'RUB',
				},
				metadata: {
					user_id: user.id,
					subscription_tier_id: subscription.subscription_tier_id,
				},
				created_at: occurredAt.toISOString(),
				payment_method: {
					id: 'pm-999',
					type: 'bank_card',
					saved: true,
					card: { last4: '9999' },
				},
			},
		};

		await sendWebhook(payload);

		const storedPaymentMethod = await subscriptionRepo.findPaymentMethod(user.id);
		expect(storedPaymentMethod).to.not.be.a('undefined');
		if (!storedPaymentMethod) {
			throw new Error('Payment method not persisted');
		}

		expect(storedPaymentMethod.payment_method_id).to.equal('pm-999');
	});

	it('stores payment method when payment_method.active webhook is received', async () => {
		const { user } = await givenSubscription({
			tierOverrides: { tier: 'premium' },
			subscriptionOverrides: {
				price_on_purchase_rubles: 2500,
				is_gifted: false,
				grace_period_size: 3,
				billing_period_days: 30,
				current_period_end: new Date('2025-02-01T00:00:00.000Z'),
				last_billing_attempt: new Date('2025-01-01T00:00:00.000Z'),
			},
		});

		const payload: YookassaPaymentMethodActiveWebhook = {
			event: 'payment_method.active',
			object: {
				id: 'pm-from-active-webhook',
				type: 'bank_card',
				status: 'active',
				saved: true,
				card: { last4: '5555' },
				metadata: {
					user_id: user.id,
				},
			},
		};

		await sendWebhook(payload);

		const storedPaymentMethod = await subscriptionRepo.findPaymentMethod(user.id);
		expect(storedPaymentMethod?.payment_method_id).to.equal('pm-from-active-webhook');

		const storedEvent = await expectStoredEvent(payload);
		expect(storedEvent.user_id).to.equal(user.id);
		expect(storedEvent.subscription_id).to.equal(null);
	});

	it('updates stored payment method when webhook contains a different one', async () => {
		const { user, subscription } = await givenSubscription({
			tierOverrides: { tier: 'premium' },
			subscriptionOverrides: {
				price_on_purchase_rubles: 2500,
				is_gifted: false,
				grace_period_size: 3,
				billing_period_days: 30,
				current_period_end: new Date('2025-02-01T00:00:00.000Z'),
				last_billing_attempt: new Date('2025-01-01T00:00:00.000Z'),
			},
			paymentMethodId: 'pm-111',
		});

		await expectPaymentMethodId(user.id, 'pm-111');

		const occurredAt = new Date('2025-01-20T10:00:00.000Z');
		const payload: YookassaPaymentSucceededWebhook = {
			event: 'payment.succeeded',
			object: {
				id: 'payment-update-method-001',
				status: 'succeeded',
				paid: true,
				amount: {
					value: '2500.00',
					currency: 'RUB',
				},
				metadata: {
					user_id: user.id,
					subscription_tier_id: subscription.subscription_tier_id,
				},
				created_at: occurredAt.toISOString(),
				payment_method: {
					id: 'pm-222',
					type: 'bank_card',
					saved: true,
					card: { last4: '2222' },
				},
			},
		};

		await sendWebhook(payload);

		await expectPaymentMethodId(user.id, 'pm-222');
		await expectStoredEvent(payload, { subscriptionId: subscription.id });
	});

	it('stores payment success event and switches subscription to cheaper tier from metadata', async () => {
		const standardTier = await createTestSubscriptionTier(usersRepo, { tier: 'standard', power: 1 });
		const currentPeriodEnd = new Date('2025-04-10T00:00:00.000Z');

		const {
			user,
			subscription,
			tier: premiumTier,
		} = await givenSubscription({
			tierOverrides: { tier: 'premium', power: 2 },
			subscriptionOverrides: {
				price_on_purchase_rubles: 3500,
				is_gifted: false,
				grace_period_size: 3,
				billing_period_days: 30,
				current_period_end: currentPeriodEnd,
				last_billing_attempt: new Date('2025-03-10T00:00:00.000Z'),
			},
			paymentMethodId: 'pm-234',
		});

		expect(standardTier.power).to.be.lessThan(premiumTier.power);

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
					subscription_tier_id: standardTier.id,
				},
				created_at: occurredAt.toISOString(),
			},
		};

		await sendWebhook(payload);

		const updatedSubscription = await findSubscriptionOrFail(subscription.id, 'Subscription missing after webhook');

		const expectedEnd = addDays(currentPeriodEnd, 30);
		expect(updatedSubscription.current_period_end?.getTime()).to.equal(expectedEnd.getTime());
		expect(updatedSubscription.last_billing_attempt?.getTime()).to.equal(occurredAt.getTime());
		expect(updatedSubscription.subscription_tier_id).to.equal(standardTier.id);
		expect(updatedSubscription.subscription_tier_id).to.not.equal(premiumTier.id);

		await expectStoredEvent(payload, { subscriptionId: subscription.id });
		await expectPaymentMethodId(user.id, 'pm-234');
	});

	it('stores payment success event and switches subscription to more expensive tier from metadata', async () => {
		const vipTier = await createTestSubscriptionTier(usersRepo, { tier: 'vip', power: 3 });
		const currentPeriodEnd = new Date('2025-05-10T00:00:00.000Z');

		const {
			user,
			subscription,
			tier: standardTier,
		} = await givenSubscription({
			tierOverrides: { tier: 'standard', power: 1 },
			subscriptionOverrides: {
				price_on_purchase_rubles: 1200,
				is_gifted: false,
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
					subscription_tier_id: vipTier.id,
				},
				created_at: occurredAt.toISOString(),
			},
		};

		await sendWebhook(payload);

		const updatedSubscription = await findSubscriptionOrFail(subscription.id, 'Subscription missing after webhook');

		const expectedEnd = addDays(currentPeriodEnd, 30);
		expect(updatedSubscription.current_period_end?.getTime()).to.equal(expectedEnd.getTime());
		expect(updatedSubscription.last_billing_attempt?.getTime()).to.equal(occurredAt.getTime());
		expect(updatedSubscription.subscription_tier_id).to.equal(vipTier.id);
		expect(updatedSubscription.subscription_tier_id).to.not.equal(standardTier.id);

		await expectStoredEvent(payload, { subscriptionId: subscription.id });
		await expectPaymentMethodId(user.id, 'pm-345');
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
				is_gifted: false,
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
					subscription_tier_id: subscription.subscription_tier_id,
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
		expect(updatedSubscription.subscription_tier_id).to.equal(premiumTier.id);
		expect(updatedSubscription.current_period_end?.getTime()).to.equal(currentPeriodEnd.getTime());
		expect(updatedSubscription.last_billing_attempt?.getTime()).to.equal(now.getTime());
		expect(updatedSubscription.is_gifted).to.equal(false);

		await expectStoredEvent(payload, { subscriptionId: subscription.id });
	});

	it('stores cancellation event and downgrades subscription to free tier outside grace period', async () => {
		const freeTier = await createTestSubscriptionTier(usersRepo, { tier: 'free' });
		const createdAt = new Date('2025-01-20T07:00:00.000Z');
		const canceledAt = new Date('2025-01-20T08:00:00.000Z');

		const {
			user,
			subscription,
			tier: premiumTier,
		} = await givenSubscription({
			tierOverrides: { tier: 'premium' },
			subscriptionOverrides: {
				price_on_purchase_rubles: 2500,
				is_gifted: false,
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
					subscription_tier_id: subscription.subscription_tier_id,
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
		expect(downgradedSubscription.subscription_tier_id).to.equal(freeTier.id);
		expect(downgradedSubscription.billing_period_days).to.equal(0);
		expect(downgradedSubscription.current_period_end).to.equal(null);
		expect(downgradedSubscription.last_billing_attempt?.getTime()).to.equal(canceledAt.getTime());
		expect(downgradedSubscription.is_gifted).to.equal(true);

		const event = await expectStoredEvent(payload);
		expect(event.subscription_id).to.equal(subscription.id);

		await expectPaymentMethodId(user.id, 'pm-456');
	});
	it('does not downgrade subscription to free tier if payment failed within grace period', async () => {
		const freeTier = await createTestSubscriptionTier(usersRepo, { tier: 'free', power: 0 });
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
				is_gifted: false,
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
					subscription_tier_id: subscription.subscription_tier_id,
				},
				created_at: canceledAt.toISOString(),
				canceled_at: createdAt.toISOString(),
			},
		};

		await sendWebhook(payload);

		const updatedSubscription = await findSubscriptionOrFail(subscription.id, 'Subscription missing after webhook');
		expect(updatedSubscription.subscription_tier_id).to.equal(premiumTier.id);
		expect(updatedSubscription.subscription_tier_id).to.not.equal(freeTier.id);
		expect(updatedSubscription.billing_period_days).to.equal(subscription.billing_period_days);
		expect(updatedSubscription.current_period_end?.getTime()).to.equal(subscription.current_period_end?.getTime());
		expect(updatedSubscription.is_gifted).to.equal(false);
		expect(updatedSubscription.last_billing_attempt?.getTime()).to.equal(canceledAt.getTime());

		const event = await expectStoredEvent(payload, { subscriptionId: subscription.id });
		expect(event.subscription_id).to.equal(subscription.id);

		await expectPaymentMethodId(user.id, 'pm-789');
	});
});
