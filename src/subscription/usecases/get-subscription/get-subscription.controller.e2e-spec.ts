import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { expect } from 'chai';
import {
	createTestAdmin,
	createTestSubscriber,
	createTestSubscriptionTier,
	createTestUser,
} from '../../../../test/fixtures/user.fixture';
import { ISharedContext } from '../../../../test/setup/test.app-setup';
import { TestHttpClient } from '../../../../test/test.http-client';
import { jwtConfig } from '../../../config';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { UsersTestRepository } from '../../../user/test-utils/test.repo';
import { GiftTestRepository } from '../../../gift/test-utils/test.repo';
import { SubscriptionTestRepository } from '../../test-utils/test.repo';
import { SubscriptionTestSdk } from '../../test-utils/test.sdk';
import { MS_IN_DAY } from '../../constants';

describe.only('[E2E] Get subscription usecase', () => {
	let app: INestApplication;
	let usersRepo: UsersTestRepository;
	let giftRepo: GiftTestRepository;
	let subscriptionRepo: SubscriptionTestRepository;
	let subscriptionSdk: SubscriptionTestSdk;

	before(function (this: ISharedContext) {
		app = this.app;
		const dbProvider = app.get(DatabaseProvider);
		usersRepo = new UsersTestRepository(dbProvider);
		giftRepo = new GiftTestRepository(dbProvider);
		subscriptionRepo = new SubscriptionTestRepository(dbProvider);
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

	it('rejects unauthenticated calls', async () => {
		const response = await subscriptionSdk.getSubscription({
			userMeta: { isAuth: false },
		});

		expect(response.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('rejects non-subscriber actor', async () => {
		const actor = await createTestUser(usersRepo);

		const response = await subscriptionSdk.getSubscription({
			userMeta: {
				userId: actor.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(response.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('returns paid subscription details without active gift', async () => {
		const currentTier = await createTestSubscriptionTier(usersRepo, {
			tier: 'standard',
			power: 2,
			price_rubles: 1500,
			permissions: ['auto-apply', 'prep'],
		});
		const nextTier = await createTestSubscriptionTier(usersRepo, {
			tier: 'premium',
			power: 5,
			price_rubles: 4500,
			permissions: ['patronum', 'fuzzer', 'interview-analysis'],
		});
		const currentPeriodEnd = new Date('2027-01-10T00:00:00.000Z');
		const subscriber = await createTestSubscriber(usersRepo, {
			current_tier_id: currentTier.id,
			active_until: currentPeriodEnd,
		});

		await subscriptionRepo.update(subscriber.subscription.id, { next_tier_id: nextTier.id });

		const response = await subscriptionSdk.getSubscription({
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

		expect(response.body.currentGiftTier).to.equal(null);
		expect(response.body.currentTier).to.deep.equal({
			id: currentTier.id,
			name: currentTier.tier,
			until: currentPeriodEnd.toISOString(),
			permissions: currentTier.permissions,
		});
		expect(response.body.nextTier).to.deep.equal({
			id: nextTier.id,
			name: nextTier.tier,
			permissions: nextTier.permissions,
		});
		expect(response.body.nextPayment).to.deep.equal({
			amount: nextTier.price_rubles,
			date: currentPeriodEnd.toISOString(),
		});
	});

	it('returns paid subscription details and active gift tier and ignores expired gifts', async () => {
		const currentTier = await createTestSubscriptionTier(usersRepo, {
			tier: 'standard',
			power: 2,
			price_rubles: 1500,
			permissions: ['prep'],
		});
		const nextTier = await createTestSubscriptionTier(usersRepo, {
			tier: 'premium',
			power: 5,
			price_rubles: 4500,
			permissions: ['auto-apply'],
		});
		const activeGiftTier = await createTestSubscriptionTier(usersRepo, {
			tier: 'gift-plus',
			power: 7,
			price_rubles: 0,
			permissions: ['patronum', 'auto-apply'],
		});
		const expiredGiftTier = await createTestSubscriptionTier(usersRepo, {
			tier: 'expired-gift',
			power: 10,
			price_rubles: 0,
			permissions: ['fuzzer'],
		});
		const currentPeriodEnd = new Date('2027-02-01T00:00:00.000Z');
		const activeGiftActivatedAt = new Date(Date.now() - MS_IN_DAY);
		const activeGiftDurationDays = 5;
		const activeGiftUntil = new Date(activeGiftActivatedAt.getTime() + activeGiftDurationDays * MS_IN_DAY);
		const subscriber = await createTestSubscriber(usersRepo, {
			current_tier_id: currentTier.id,
			active_until: currentPeriodEnd,
		});
		const admin = await createTestAdmin(usersRepo);

		await subscriptionRepo.update(subscriber.subscription.id, { next_tier_id: nextTier.id });
		await giftRepo.insertGift({
			gifted_by: admin.id,
			gifted_to: subscriber.id,
			tier_id: expiredGiftTier.id,
			activated_at: new Date(Date.now() - 10 * MS_IN_DAY),
			duration_days: 1,
		});
		await giftRepo.insertGift({
			gifted_by: admin.id,
			gifted_to: subscriber.id,
			tier_id: activeGiftTier.id,
			activated_at: activeGiftActivatedAt,
			duration_days: activeGiftDurationDays,
		});

		const response = await subscriptionSdk.getSubscription({
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

		expect(response.body.currentGiftTier).to.deep.equal({
			id: activeGiftTier.id,
			name: activeGiftTier.tier,
			until: activeGiftUntil.toISOString(),
			permissions: activeGiftTier.permissions,
		});
		expect(response.body.currentTier).to.deep.equal({
			id: currentTier.id,
			name: currentTier.tier,
			until: currentPeriodEnd.toISOString(),
			permissions: currentTier.permissions,
		});
		expect(response.body.nextTier).to.deep.equal({
			id: nextTier.id,
			name: nextTier.tier,
			permissions: nextTier.permissions,
		});
		expect(response.body.nextPayment).to.deep.equal({
			amount: nextTier.price_rubles,
			date: currentPeriodEnd.toISOString(),
		});
	});
});
