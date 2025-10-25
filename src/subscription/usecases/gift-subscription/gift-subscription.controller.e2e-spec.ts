import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { jwtConfig } from '../../../config';
import { ISharedContext } from '../../../../test/setup/test.app-setup';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { UsersTestRepository } from '../../../user/test-utils/test.repo';
import { SubscriptionTestRepository } from '../../test-utils/test.repo';
import { SubscriptionTestSdk } from '../../test-utils/test.sdk';
import { TestHttpClient } from '../../../../test/test.http-client';
import { createTestAdmin, createTestSubscriptionTier, createTestUser } from '../../../../test/fixtures/user.fixture';

describe('[E2E] Gift subscription usecase', () => {
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

	it('rejects non-admin actor', async () => {
		const actor = await createTestUser(usersRepo);
		const recipient = await createTestUser(usersRepo);
		const tier = await createTestSubscriptionTier(usersRepo);

		const response = await subscriptionSdk.giftSubscription({
			params: {
				userId: recipient.id,
				subscriptionTierId: tier.id,
			},
			userMeta: {
				userId: actor.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(response.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('creates gifted subscription and stores gifted subscription data', async () => {
		const now = new Date('2024-11-01T00:00:00.000Z');
		const clock = sinon.useFakeTimers({
			now: now.getTime(),
			shouldClearNativeTimers: true,
			toFake: ['Date'],
		});

		try {
			const admin = await createTestAdmin(usersRepo);
			const recipient = await createTestUser(usersRepo, { role: 'subscriber' });

			const freeTier = await createTestSubscriptionTier(usersRepo, { tier: 'free' });
			const premiumTier = await createTestSubscriptionTier(usersRepo, { tier: 'premium' });

			expect(freeTier.id).to.not.equal(premiumTier.id);

			const response = await subscriptionSdk.giftSubscription({
				params: {
					userId: recipient.id,
					subscriptionTierId: premiumTier.id,
					durationDays: 20,
					gracePeriodSize: 2,
				},
				userMeta: {
					userId: admin.id,
					isAuth: true,
					isWrongAccessJwt: false,
				},
			});

			expect(response.status).to.equal(HttpStatus.CREATED);
			if (response.status !== HttpStatus.CREATED) {
				throw new Error('Unexpected response status');
			}

			const expectedPeriodEnd = new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000);

			expect(response.body.userId).to.equal(recipient.id);
			expect(response.body.subscriptionTierId).to.equal(premiumTier.id);
			expect(response.body.status).to.equal('active');
			expect(response.body.isGifted).to.equal(true);
			expect(response.body.billingPeriodDays).to.equal(20);
			expect(response.body.gracePeriodSize).to.equal(2);
			expect(response.body.paymentMethodId).to.equal(null);

			const persistedSubscription = await subscriptionRepo.findById(response.body.id);
			expect(persistedSubscription).to.not.be.a('undefined');
			if (!persistedSubscription) {
				throw new Error('Subscription not found');
			}

			expect(persistedSubscription.subscription_tier_id).to.equal(premiumTier.id);
			expect(persistedSubscription.user_id).to.equal(recipient.id);
			expect(persistedSubscription.is_gifted).to.equal(true);
			expect(persistedSubscription.billing_period_days).to.equal(20);
			expect(persistedSubscription.grace_period_size).to.equal(2);
			expect(persistedSubscription.current_period_end.getTime()).to.equal(expectedPeriodEnd.getTime());
			expect(persistedSubscription.next_billing_at).to.equal(null);
			expect(persistedSubscription.billing_retry_attempts).to.equal(0);

			const paymentMethod = await subscriptionRepo.findPaymentMethod(recipient.id);
			expect(paymentMethod).to.be.a('undefined');
		} finally {
			clock.restore();
		}
	});
});
