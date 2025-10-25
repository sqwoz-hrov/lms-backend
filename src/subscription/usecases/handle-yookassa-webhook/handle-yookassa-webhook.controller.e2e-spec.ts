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
			status: 'active',
			price_on_purchase_rubles: 2500,
			is_gifted: false,
			grace_period_size: 3,
			billing_period_days: 30,
			current_period_end: currentPeriodEnd,
			next_billing_at: currentPeriodEnd,
			billing_retry_attempts: 1,
			last_billing_attempt: new Date('2024-12-01T00:00:00.000Z'),
		};

		const subscription = await subscriptionRepo.insert(newSubscriptionPayload);
		await subscriptionRepo.upsertPaymentMethod({
			userId: user.id,
			paymentMethodId: 'pm-123',
		});

		const occurredAt = new Date('2024-12-15T12:00:00.000Z');
		const payload = {
			event: 'payment.succeeded',
			object: {
				id: 'payment-001',
				metadata: {
					userId: user.id,
					subscriptionId: subscription.id,
				},
				captured_at: occurredAt.toISOString(),
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
		expect(updatedSubscription.status).to.equal('active');
		expect(updatedSubscription.current_period_end.getTime()).to.equal(expectedEnd.getTime());
		expect(updatedSubscription.next_billing_at?.getTime()).to.equal(expectedEnd.getTime());
		expect(updatedSubscription.billing_retry_attempts).to.equal(0);
		expect(updatedSubscription.last_billing_attempt?.getTime()).to.equal(occurredAt.getTime());
		const paymentMethod = await subscriptionRepo.findPaymentMethod(user.id);
		expect(paymentMethod?.payment_method_id).to.equal('pm-123');

		const events = await subscriptionRepo.findPaymentEvents({ subscriptionId: subscription.id });
		expect(events.length).to.equal(1);
		expect(events[0].event).to.deep.equal(payload);
	});

	it('stores cancellation event and removes subscription access', async () => {
		const freeTier = await createTestSubscriptionTier(usersRepo, { tier: 'free' });
		const premiumTier = await createTestSubscriptionTier(usersRepo, { tier: 'premium' });
		expect(freeTier.id).to.not.equal(premiumTier.id);

		const user = await createTestUser(usersRepo, { role: 'subscriber' });

		const subscription = await subscriptionRepo.insert({
			user_id: user.id,
			subscription_tier_id: premiumTier.id,
			status: 'past_due',
			price_on_purchase_rubles: 2500,
			is_gifted: false,
			grace_period_size: 2,
			billing_period_days: 30,
			current_period_end: new Date('2025-02-01T00:00:00.000Z'),
			next_billing_at: new Date('2025-02-01T00:00:00.000Z'),
			billing_retry_attempts: 2,
			last_billing_attempt: new Date('2025-01-15T00:00:00.000Z'),
		});
		await subscriptionRepo.upsertPaymentMethod({
			userId: user.id,
			paymentMethodId: 'pm-456',
		});

		const canceledAt = new Date('2025-01-20T08:00:00.000Z');
		const payload = {
			event: 'payment.canceled',
			object: {
				id: 'payment-002',
				metadata: {
					user_id: user.id,
					subscription_id: subscription.id,
				},
				canceled_at: canceledAt.toISOString(),
			},
		};

		const response = await subscriptionSdk.sendYookassaWebhook({
			params: payload,
			userMeta: { isAuth: false },
		});

		expect(response.status).to.equal(HttpStatus.OK);

		const deletedSubscription = await subscriptionRepo.findById(subscription.id);
		expect(deletedSubscription).to.be.a('undefined');

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
});
