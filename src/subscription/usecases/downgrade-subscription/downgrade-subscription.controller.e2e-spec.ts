import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { expect } from 'chai';
import { jwtConfig } from '../../../config';
import { ISharedContext } from '../../../../test/setup/test.app-setup';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { UsersTestRepository } from '../../../user/test-utils/test.repo';
import { SubscriptionTestRepository } from '../../test-utils/test.repo';
import { SubscriptionTestSdk } from '../../test-utils/test.sdk';
import { TestHttpClient } from '../../../../test/test.http-client';
import {
	createTestAdmin,
	createTestSubscriber,
	createTestSubscriptionTier,
	createTestUser,
} from '../../../../test/fixtures/user.fixture';
import { GiftTestRepository } from '../../../gift/test-utils/test.repo';
import { UserRepository } from '../../../user/user.repository';

describe('[E2E] Downgrade subscription usecase', () => {
	let app: INestApplication;
	let usersRepo: UsersTestRepository;
	let userRepository: UserRepository;
	let subscriptionRepo: SubscriptionTestRepository;
	let giftRepo: GiftTestRepository;
	let subscriptionSdk: SubscriptionTestSdk;

	before(function (this: ISharedContext) {
		app = this.app;
		const dbProvider = app.get(DatabaseProvider);
		usersRepo = new UsersTestRepository(dbProvider);
		userRepository = new UserRepository(dbProvider);
		subscriptionRepo = new SubscriptionTestRepository(dbProvider);
		giftRepo = new GiftTestRepository(dbProvider);
		subscriptionSdk = new SubscriptionTestSdk(
			new TestHttpClient(
				{ port: 3000, host: 'http://127.0.0.1' },
				app.get<ConfigType<typeof jwtConfig>>(jwtConfig.KEY),
			),
		);
	});

	afterEach(async () => {
		await giftRepo.clearAll();
		await subscriptionRepo.clearAll();
		await usersRepo.clearAll();
	});

	it('rejects non-subscriber actor', async () => {
		const actor = await createTestUser(usersRepo);
		const downgradeTier = await createTestSubscriptionTier(usersRepo, {
			tier: 'standard',
			power: 1,
			price_rubles: 1200,
		});

		const response = await subscriptionSdk.downgradeSubscription({
			params: {
				subscriptionTierId: downgradeTier.id,
			},
			userMeta: {
				userId: actor.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(response.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('downgrades subscription to a cheaper billable tier without touching billing schedule', async () => {
		const premiumTier = await createTestSubscriptionTier(usersRepo, { tier: 'premium', power: 5, price_rubles: 4500 });
		const standardTier = await createTestSubscriptionTier(usersRepo, {
			tier: 'standard',
			power: 3,
			price_rubles: 1500,
		});

		const activeUntil = new Date('2024-12-01T00:00:00.000Z');
		const subscriber = await createTestSubscriber(usersRepo, {
			current_tier_id: premiumTier.id,
			active_until: activeUntil,
		});
		const existingUserWithSubscription = await userRepository.findByIdWithSubscriptionTier(subscriber.id);
		const existingSubscription = existingUserWithSubscription?.subscription;
		const lastAttempt = new Date('2024-11-05T10:00:00.000Z');

		if (!existingSubscription) {
			throw new Error('Unexpectedly did not find the subscription');
		}

		await usersRepo.connection
			.updateTable('subscription')
			.set({ last_billing_attempt: lastAttempt, updated_at: new Date() })
			.where('id', '=', existingSubscription.id)
			.execute();

		const response = await subscriptionSdk.downgradeSubscription({
			params: {
				subscriptionTierId: standardTier.id,
			},
			userMeta: {
				userId: subscriber.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(response.status).to.equal(HttpStatus.OK);
		if (response.status !== HttpStatus.OK) {
			throw new Error('Unexpected response status');
		}

		// current tier did not change
		expect(response.body.currentTierId).to.equal(existingSubscription.current_tier_id);
		// next tier is set to the downgraded one
		expect(response.body.nextTierId).to.equal(standardTier.id);
		expect(response.body.priceOnPurchaseRubles).to.equal(standardTier.price_rubles);
		expect(response.body.billingPeriodDays).to.equal(existingSubscription.billing_period_days);
		expect(response.body.currentPeriodEnd).to.equal(existingSubscription.current_period_end?.toISOString());
		expect(response.body.lastBillingAttempt).to.equal(lastAttempt.toISOString());
		expect(response.body.gracePeriodSize).to.equal(existingSubscription.grace_period_size);

		const persisted = await subscriptionRepo.findById(existingSubscription.id);
		expect(persisted).to.not.be.a('undefined');
		if (!persisted) {
			throw new Error('Subscription not found');
		}

		expect(persisted.current_tier_id).to.equal(existingSubscription.current_tier_id);
		expect(persisted.next_tier_id).to.equal(standardTier.id);
		expect(persisted.price_on_purchase_rubles).to.equal(standardTier.price_rubles);
		expect(persisted.billing_period_days).to.equal(existingSubscription.billing_period_days);
		expect(persisted.current_period_end?.getTime()).to.equal(activeUntil.getTime());
		expect(persisted.last_billing_attempt?.getTime()).to.equal(lastAttempt.getTime());
	});

	it('downgrades subscription to a free tier', async () => {
		const premiumTier = await createTestSubscriptionTier(usersRepo, { tier: 'premium', power: 4, price_rubles: 3200 });
		const freeTier = await createTestSubscriptionTier(usersRepo, { tier: 'free', power: 0, price_rubles: 0 });

		const subscriber = await createTestSubscriber(usersRepo, {
			current_tier_id: premiumTier.id,
			active_until: new Date('2024-12-15T00:00:00.000Z'),
		});
		const existingSubscription = subscriber.subscription;
		const lastAttempt = new Date('2024-11-10T08:00:00.000Z');

		await usersRepo.connection
			.updateTable('subscription')
			.set({ last_billing_attempt: lastAttempt, updated_at: new Date() })
			.where('id', '=', existingSubscription.id)
			.execute();

		const response = await subscriptionSdk.downgradeSubscription({
			params: {
				subscriptionTierId: freeTier.id,
			},
			userMeta: {
				userId: subscriber.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(response.status).to.equal(HttpStatus.OK);
		if (response.status !== HttpStatus.OK) {
			throw new Error('Unexpected response status');
		}

		// current tier did not change
		expect(response.body.currentTierId).to.equal(existingSubscription.current_tier_id);
		// next tier is set to the downgraded one
		expect(response.body.nextTierId).to.equal(freeTier.id);

		const persisted = await subscriptionRepo.findById(existingSubscription.id);
		expect(persisted).to.not.be.a('undefined');
		if (!persisted) {
			throw new Error('Subscription not found');
		}

		expect(persisted.current_tier_id).to.equal(existingSubscription.current_tier_id);
		expect(persisted.next_tier_id).to.equal(freeTier.id);
	});

	it('lets user downgrade despite having active higher-power gift and only lowers next tier', async () => {
		const premiumTier = await createTestSubscriptionTier(usersRepo, { tier: 'premium', power: 4, price_rubles: 3200 });
		const freeTier = await createTestSubscriptionTier(usersRepo, { tier: 'free', power: 0, price_rubles: 0 });
		const giftedTier = await createTestSubscriptionTier(usersRepo, { tier: 'gifted-vip', power: 10, price_rubles: 8000 });

		// TODO: refactor - use other helpers
		const activeUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
		const subscriber = await createTestSubscriber(usersRepo, {
			current_tier_id: premiumTier.id,
			active_until: activeUntil,
		});
		const admin = await createTestAdmin(usersRepo);
		const existingSubscription = subscriber.subscription;

		// TODO: refactor: prefer SDK calls over repo stuff
		await giftRepo.insertGift({
			gifted_by: admin.id,
			gifted_to: subscriber.id,
			tier_id: giftedTier.id,
			duration_days: 10,
			activated_at: new Date(),
		});

		const response = await subscriptionSdk.downgradeSubscription({
			params: {
				subscriptionTierId: freeTier.id,
			},
			userMeta: {
				userId: subscriber.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(response.status).to.equal(HttpStatus.OK);
		if (response.status !== HttpStatus.OK) {
			throw new Error('Unexpected response status');
		}

		expect(response.body.currentTierId).to.equal(existingSubscription.current_tier_id);
		expect(response.body.nextTierId).to.equal(freeTier.id);

		const userWithSubscription = await userRepository.findByIdWithSubscriptionTier(subscriber.id);
		expect(userWithSubscription?.subscription?.current_tier_id).to.equal(giftedTier.id);
		expect(userWithSubscription?.subscription_tier?.id).to.equal(giftedTier.id);
		expect(userWithSubscription?.subscription?.next_tier_id).to.equal(freeTier.id);
	});

	it('rejects attempts to upgrade subscription via downgrade endpoint', async () => {
		const standardTier = await createTestSubscriptionTier(usersRepo, {
			tier: 'standard',
			power: 3,
			price_rubles: 1800,
		});
		const premiumTier = await createTestSubscriptionTier(usersRepo, { tier: 'premium', power: 6, price_rubles: 3600 });

		const subscriber = await createTestSubscriber(usersRepo, {
			current_tier_id: standardTier.id,
			active_until: new Date('2024-11-25T00:00:00.000Z'),
		});

		const response = await subscriptionSdk.downgradeSubscription({
			params: {
				subscriptionTierId: premiumTier.id,
			},
			userMeta: {
				userId: subscriber.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(response.status).to.equal(HttpStatus.CONFLICT);
		if (response.status !== HttpStatus.CONFLICT) {
			throw new Error('Unexpected response status');
		}
		expect(response.body.description).to.equal(
			`Cannot downgrade subscription tier from "${standardTier.tier}" to "${premiumTier.tier}"`,
		);
	});
});
