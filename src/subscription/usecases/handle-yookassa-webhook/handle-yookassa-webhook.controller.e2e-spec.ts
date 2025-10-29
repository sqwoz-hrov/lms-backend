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
	YookassaPaymentSucceededWebhook,
	YookassaWebhookPayload,
} from '../../types/yookassa-webhook';
import { randomUUID } from 'crypto';

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

describe.only('[E2E] Handle YooKassa webhook', () => {
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

		const response = await subscriptionSdk.sendYookassaWebhook({
			params: rawPayload as unknown as YookassaWebhookPayload,
			userMeta: { isAuth: false },
		});

		expect(response.status).to.equal(HttpStatus.OK);

		const events = await subscriptionRepo.findPaymentEvents();
		expect(events.length).to.equal(1);
		expect(events[0].event).to.deep.equal(rawPayload);
		expect(events[0].subscription_id).to.equal(null);
		expect(events[0].user_id).to.equal(null);
	});

	it('stores payment success event and prolongs subscription', async () => {
		const freeTier = await createTestSubscriptionTier(usersRepo, { tier: 'free' });
		const premiumTier = await createTestSubscriptionTier(usersRepo, { tier: 'premium' });
		expect(freeTier).to.not.deep.equal(premiumTier);

		const user = await createTestUser(usersRepo, { role: 'subscriber' });

		const currentPeriodEnd = new Date('2025-01-05T00:00:00.000Z');
		const currentSubscription: NewSubscription = {
			user_id: user.id,
			subscription_tier_id: premiumTier.id,
			price_on_purchase_rubles: 2500,
			is_gifted: false,
			grace_period_size: 3,
			billing_period_days: 30,
			current_period_end: currentPeriodEnd,
			last_billing_attempt: new Date('2024-12-01T00:00:00.000Z'),
		};

		const subscription = await subscriptionRepo.insert(currentSubscription);
		await subscriptionRepo.upsertPaymentMethod({
			userId: user.id,
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
			},
		};

		const response = await subscriptionSdk.sendYookassaWebhook({
			params: payload,
			userMeta: { isAuth: false },
		});

		expect(response.status).to.equal(HttpStatus.OK);

		const updatedSubscription = await subscriptionRepo.findById(subscription.id);
		expect(updatedSubscription).to.not.be.a('undefined');
		if (!updatedSubscription) {
			throw new Error('Subscription missing after webhook');
		}

		const expectedEnd = addDays(currentPeriodEnd, currentSubscription.billing_period_days);
		expect(updatedSubscription.current_period_end?.getTime()).to.equal(expectedEnd.getTime());
		expect(updatedSubscription.last_billing_attempt?.getTime()).to.equal(occurredAt.getTime());
		const paymentMethod = await subscriptionRepo.findPaymentMethod(user.id);
		expect(paymentMethod?.payment_method_id).to.equal('pm-123');

		const events = await subscriptionRepo.findPaymentEvents({ subscriptionId: subscription.id });
		expect(events.length).to.equal(1);
		expect(events[0].event).to.deep.equal(payload);
	});

	it('stores payment success event and switches subscription to cheaper tier from metadata', async () => {
		const standardTier = await createTestSubscriptionTier(usersRepo, { tier: 'standard', power: 1 });
		const premiumTier = await createTestSubscriptionTier(usersRepo, { tier: 'premium', power: 2 });
		expect(standardTier.power).to.be.lessThan(premiumTier.power);

		const user = await createTestUser(usersRepo, { role: 'subscriber' });

		const currentPeriodEnd = new Date('2025-04-10T00:00:00.000Z');
		const currentSubscription: NewSubscription = {
			user_id: user.id,
			subscription_tier_id: premiumTier.id,
			price_on_purchase_rubles: 3500,
			is_gifted: false,
			grace_period_size: 3,
			billing_period_days: 30,
			current_period_end: currentPeriodEnd,
			last_billing_attempt: new Date('2025-03-10T00:00:00.000Z'),
		};

		const subscription = await subscriptionRepo.insert(currentSubscription);
		await subscriptionRepo.upsertPaymentMethod({
			userId: user.id,
			paymentMethodId: 'pm-234',
		});

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

		const response = await subscriptionSdk.sendYookassaWebhook({
			params: payload,
			userMeta: { isAuth: false },
		});

		expect(response.status).to.equal(HttpStatus.OK);

		const updatedSubscription = await subscriptionRepo.findById(subscription.id);
		expect(updatedSubscription).to.not.be.a('undefined');
		if (!updatedSubscription) {
			throw new Error('Subscription missing after webhook');
		}

		const expectedEnd = addDays(currentPeriodEnd, currentSubscription.billing_period_days);
		expect(updatedSubscription.current_period_end?.getTime()).to.equal(expectedEnd.getTime());
		expect(updatedSubscription.last_billing_attempt?.getTime()).to.equal(occurredAt.getTime());
		expect(updatedSubscription.subscription_tier_id).to.equal(standardTier.id);
		expect(updatedSubscription.subscription_tier_id).to.not.equal(premiumTier.id);

		const events = await subscriptionRepo.findPaymentEvents({ subscriptionId: subscription.id });
		expect(events.length).to.equal(1);
		expect(events[0].event).to.deep.equal(payload);

		const paymentMethod = await subscriptionRepo.findPaymentMethod(user.id);
		expect(paymentMethod?.payment_method_id).to.equal('pm-234');
	});

	it('stores payment success event and switches subscription to more expensive tier from metadata', async () => {
		const standardTier = await createTestSubscriptionTier(usersRepo, { tier: 'standard', power: 1 });
		const vipTier = await createTestSubscriptionTier(usersRepo, { tier: 'vip', power: 3 });
		expect(standardTier.power).to.be.lessThan(vipTier.power);

		const user = await createTestUser(usersRepo, { role: 'subscriber' });

		const currentPeriodEnd = new Date('2025-05-10T00:00:00.000Z');
		const currentSubscription: NewSubscription = {
			user_id: user.id,
			subscription_tier_id: standardTier.id,
			price_on_purchase_rubles: 1200,
			is_gifted: false,
			grace_period_size: 3,
			billing_period_days: 30,
			current_period_end: currentPeriodEnd,
			last_billing_attempt: new Date('2025-04-10T00:00:00.000Z'),
		};

		const subscription = await subscriptionRepo.insert(currentSubscription);
		await subscriptionRepo.upsertPaymentMethod({
			userId: user.id,
			paymentMethodId: 'pm-345',
		});

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

		const response = await subscriptionSdk.sendYookassaWebhook({
			params: payload,
			userMeta: { isAuth: false },
		});

		expect(response.status).to.equal(HttpStatus.OK);

		const updatedSubscription = await subscriptionRepo.findById(subscription.id);
		expect(updatedSubscription).to.not.be.a('undefined');
		if (!updatedSubscription) {
			throw new Error('Subscription missing after webhook');
		}

		const expectedEnd = addDays(currentPeriodEnd, currentSubscription.billing_period_days);
		expect(updatedSubscription.current_period_end?.getTime()).to.equal(expectedEnd.getTime());
		expect(updatedSubscription.last_billing_attempt?.getTime()).to.equal(occurredAt.getTime());
		expect(updatedSubscription.subscription_tier_id).to.equal(vipTier.id);
		expect(updatedSubscription.subscription_tier_id).to.not.equal(standardTier.id);

		const events = await subscriptionRepo.findPaymentEvents({ subscriptionId: subscription.id });
		expect(events.length).to.equal(1);
		expect(events[0].event).to.deep.equal(payload);

		const paymentMethod = await subscriptionRepo.findPaymentMethod(user.id);
		expect(paymentMethod?.payment_method_id).to.equal('pm-345');
	});

	it('stores cancellation event and downgrades subscription to free tier outside grace period', async () => {
		const freeTier = await createTestSubscriptionTier(usersRepo, { tier: 'free' });
		const premiumTier = await createTestSubscriptionTier(usersRepo, { tier: 'premium' });
		expect(freeTier.id).to.not.equal(premiumTier.id);

		const user = await createTestUser(usersRepo, { role: 'subscriber' });

		const subscription = await subscriptionRepo.insert({
			user_id: user.id,
			subscription_tier_id: premiumTier.id,
			price_on_purchase_rubles: 2500,
			is_gifted: false,
			grace_period_size: 2,
			billing_period_days: 30,
			current_period_end: new Date('2025-01-15T00:00:00.000Z'),
			last_billing_attempt: new Date('2025-01-15T00:00:00.000Z'),
		});
		await subscriptionRepo.upsertPaymentMethod({
			userId: user.id,
			paymentMethodId: 'pm-456',
		});

		const createdAt = new Date('2025-01-20T07:00:00.000Z');
		const canceledAt = new Date('2025-01-20T08:00:00.000Z');
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

		const response = await subscriptionSdk.sendYookassaWebhook({
			params: payload,
			userMeta: { isAuth: false },
		});

		expect(response.status).to.equal(HttpStatus.OK);

		const downgradedSubscription = await subscriptionRepo.findById(subscription.id);
		expect(downgradedSubscription).to.not.be.a('undefined');
		if (!downgradedSubscription) {
			throw new Error('Subscription missing after downgrade');
		}
		expect(downgradedSubscription.subscription_tier_id).to.equal(freeTier.id);
		expect(downgradedSubscription.billing_period_days).to.equal(0);
		expect(downgradedSubscription.current_period_end).to.equal(null);
		expect(downgradedSubscription.last_billing_attempt?.getTime()).to.equal(canceledAt.getTime());
		expect(downgradedSubscription.is_gifted).to.equal(true);
		const events = await subscriptionRepo.findPaymentEvents();
		const matchingEvent = events.find(event => event.event && (event.event as any).object?.id === 'payment-002');
		expect(matchingEvent).to.not.be.a('undefined');
		if (!matchingEvent) {
			throw new Error('Cancellation event was not persisted');
		}
		expect(matchingEvent.event).to.deep.equal(payload);
		expect(matchingEvent.subscription_id).to.equal(subscription.id);

		const paymentMethod = await subscriptionRepo.findPaymentMethod(user.id);
		expect(paymentMethod?.payment_method_id).to.equal('pm-456');
	});

	it('does not downgrade subscription to free tier if payment failed within grace period', async () => {
		const freeTier = await createTestSubscriptionTier(usersRepo, { tier: 'free', power: 0 });
		const premiumTier = await createTestSubscriptionTier(usersRepo, { tier: 'premium', power: 1 });
		expect(freeTier.id).to.not.equal(premiumTier.id);

		const user = await createTestUser(usersRepo, { role: 'subscriber' });

		const currentPeriodEnd = new Date('2025-03-10T00:00:00.000Z');
		const subscription = await subscriptionRepo.insert({
			user_id: user.id,
			subscription_tier_id: premiumTier.id,
			price_on_purchase_rubles: 2500,
			is_gifted: false,
			grace_period_size: 5,
			billing_period_days: 30,
			current_period_end: currentPeriodEnd,
			last_billing_attempt: new Date('2025-02-10T00:00:00.000Z'),
		});
		await subscriptionRepo.upsertPaymentMethod({
			userId: user.id,
			paymentMethodId: 'pm-789',
		});

		const createdAt = new Date('2025-01-20T07:00:00.000Z');
		const canceledAt = new Date('2025-03-12T12:00:00.000Z');
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

		const response = await subscriptionSdk.sendYookassaWebhook({
			params: payload,
			userMeta: { isAuth: false },
		});

		expect(response.status).to.equal(HttpStatus.OK);

		const updatedSubscription = await subscriptionRepo.findById(subscription.id);
		expect(updatedSubscription).to.not.be.a('undefined');
		if (!updatedSubscription) {
			throw new Error('Subscription missing after webhook');
		}
		expect(updatedSubscription.subscription_tier_id).to.equal(premiumTier.id);
		expect(updatedSubscription.subscription_tier_id).to.not.equal(freeTier.id);
		expect(updatedSubscription.billing_period_days).to.equal(subscription.billing_period_days);
		expect(updatedSubscription.current_period_end?.getTime()).to.equal(subscription.current_period_end?.getTime());
		expect(updatedSubscription.is_gifted).to.equal(false);
		expect(updatedSubscription.last_billing_attempt?.getTime()).to.equal(canceledAt.getTime());

		const events = await subscriptionRepo.findPaymentEvents({ subscriptionId: subscription.id });
		expect(events.length).to.equal(1);
		expect(events[0].event).to.deep.equal(payload);
		expect(events[0].subscription_id).to.equal(subscription.id);

		const paymentMethod = await subscriptionRepo.findPaymentMethod(user.id);
		expect(paymentMethod?.payment_method_id).to.equal('pm-789');
	});
});
