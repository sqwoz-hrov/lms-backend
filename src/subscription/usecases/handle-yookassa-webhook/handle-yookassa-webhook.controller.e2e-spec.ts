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
import { YookassaPaymentCanceledWebhook, YookassaPaymentSucceededWebhook } from '../../types/yookassa-webhook';

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

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

	it('stores payment success event and prolongs subscription', async () => {
		const freeTier = await createTestSubscriptionTier(usersRepo, { tier: 'free' });
		const premiumTier = await createTestSubscriptionTier(usersRepo, { tier: 'premium' });
		expect(freeTier).to.not.deep.equal(premiumTier);

		const user = await createTestUser(usersRepo, { role: 'subscriber' });

		const currentPeriodEnd = new Date('2025-01-05T00:00:00.000Z');
		const newSubscriptionPayload: NewSubscription = {
			user_id: user.id,
			subscription_tier_id: premiumTier.id,
			price_on_purchase_rubles: 2500,
			is_gifted: false,
			grace_period_size: 3,
			billing_period_days: 30,
			current_period_end: currentPeriodEnd,
			last_billing_attempt: new Date('2024-12-01T00:00:00.000Z'),
		};

		const subscription = await subscriptionRepo.insert(newSubscriptionPayload);
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
					userId: user.id,
					subscriptionId: subscription.id,
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

		const expectedEnd = addDays(currentPeriodEnd, newSubscriptionPayload.billing_period_days);
		expect(updatedSubscription.current_period_end?.getTime()).to.equal(expectedEnd.getTime());
		expect(updatedSubscription.last_billing_attempt?.getTime()).to.equal(occurredAt.getTime());
		const paymentMethod = await subscriptionRepo.findPaymentMethod(user.id);
		expect(paymentMethod?.payment_method_id).to.equal('pm-123');

		const events = await subscriptionRepo.findPaymentEvents({ subscriptionId: subscription.id });
		expect(events.length).to.equal(1);
		expect(events[0].event).to.deep.equal(payload);
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
					subscription_id: subscription.id,
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
		const freeTier = await createTestSubscriptionTier(usersRepo, { tier: 'free' });
		const premiumTier = await createTestSubscriptionTier(usersRepo, { tier: 'premium' });
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
					subscription_id: subscription.id,
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
