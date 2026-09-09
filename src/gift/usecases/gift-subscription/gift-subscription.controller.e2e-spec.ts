import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { jwtConfig } from '../../../config';
import { ISharedContext } from '../../../../test/setup/test.app-setup';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { UsersTestRepository } from '../../../user/test-utils/test.repo';
import { SubscriptionTestRepository } from '../../../subscription/test-utils/test.repo';
import { TestHttpClient } from '../../../../test/test.http-client';
import {
	createTestAdmin,
	createTestSubscriber,
	createTestSubscriptionTier,
	createTestUser,
} from '../../../../test/fixtures/user.fixture';
import { GiftTestSdk } from '../../test-utils/test.sdk';
import { GiftTestRepository } from '../../test-utils/test.repo';

describe('[E2E] Gift subscription usecase', () => {
	let app: INestApplication;

	let usersRepo: UsersTestRepository;
	let subscriptionRepo: SubscriptionTestRepository;
	let giftRepo: GiftTestRepository;
	let giftSdk: GiftTestSdk;

	before(function (this: ISharedContext) {
		app = this.app;
		const dbProvider = app.get(DatabaseProvider);
		usersRepo = new UsersTestRepository(dbProvider);
		subscriptionRepo = new SubscriptionTestRepository(dbProvider);
		giftRepo = new GiftTestRepository(dbProvider);

		giftSdk = new GiftTestSdk(
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
		await app.get(DatabaseProvider).getDatabase<any>().deleteFrom('gift').execute();
		await usersRepo.clearAll();
	});

	it('rejects non-admin actor', async () => {
		const actor = await createTestUser(usersRepo);
		const recipient = await createTestUser(usersRepo);
		const tier = await createTestSubscriptionTier(usersRepo);

		const response = await giftSdk.giftSubscription({
			params: {
				giftToUserId: recipient.id,
				subscriptionTierId: tier.id,
				durationDays: 30,
			},
			userMeta: {
				userId: actor.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(response.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('cannot send gift for a non-subscriber user without existing subscription', async () => {
		const admin = await createTestAdmin(usersRepo);
		const recipient = await createTestUser(usersRepo, { role: 'user' });
		const tier = await createTestSubscriptionTier(usersRepo, { tier: 'gift-for-subscriber-only', power: 2 });

		const response = await giftSdk.giftSubscription({
			params: {
				giftToUserId: recipient.id,
				subscriptionTierId: tier.id,
				durationDays: 30,
			},
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(response.status).to.equal(HttpStatus.BAD_REQUEST);
		if (response.status !== HttpStatus.BAD_REQUEST) {
			throw new Error('Unexpected response status');
		}
		expect(response.body.description).to.equal(`Can't gift subscription to a non-subscriber user`);
	});

	it('creates an inactive gift and leaves recipient subscription unchanged when recipient already has a paid sub tier', async () => {
		const now = new Date('2024-11-01T00:00:00.000Z');
		const clock = sinon.useFakeTimers({
			now: now.getTime(),
			shouldClearNativeTimers: true,
			toFake: ['Date'],
		});

		try {
			const admin = await createTestAdmin(usersRepo);
			// TODO: refactor: use "createTestSubscriber"
			const recipient = await createTestUser(usersRepo, { role: 'subscriber' });

			const freeTier = await createTestSubscriptionTier(usersRepo, { tier: 'expensivier-than-free', power: 1 });
			const premiumTier = await createTestSubscriptionTier(usersRepo, { tier: 'premium', power: 5 });
			const existingSubscription = await subscriptionRepo.insert({
				user_id: recipient.id,
				current_tier_id: freeTier.id,
				next_tier_id: freeTier.id,
				price_on_purchase_rubles: freeTier.price_rubles,
				grace_period_size: 3,
				billing_period_days: 30,
				current_period_end: new Date('2024-12-01T00:00:00.000Z'),
				last_billing_attempt: new Date('2024-10-01T00:00:00.000Z'),
			});

			expect(freeTier.id).to.not.equal(premiumTier.id);

			const response = await giftSdk.giftSubscription({
				params: {
					giftToUserId: recipient.id,
					subscriptionTierId: premiumTier.id,
					durationDays: 20,
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

			expect(response.body.giftToUserId).to.equal(recipient.id);
			expect(response.body.giftedToEmail).to.equal(recipient.email);
			expect(response.body.giftedToUsername).to.equal(recipient.name);
			expect(response.body.subscriptionTierName).to.equal(premiumTier.tier);
			expect(response.body.durationDays).to.equal(20);

			const persistedSubscription = await giftRepo.getByFields({
				giftedBy: admin.id,
				giftedTo: recipient.id,
				tierId: premiumTier.id,
			});
			expect(persistedSubscription).to.not.be.a('undefined');
			if (!persistedSubscription) {
				throw new Error('Gift not found');
			}

			expect(persistedSubscription.gifted_by).to.equal(admin.id);
			expect(persistedSubscription.gifted_to).to.equal(recipient.id);
			expect(persistedSubscription.tier_id).to.equal(premiumTier.id);
			expect(persistedSubscription.duration_days).to.equal(20);
			expect(persistedSubscription.activated_at).to.equal(null);

			const persistedOriginalSubscription = await subscriptionRepo.findById(existingSubscription.id);
			expect(persistedOriginalSubscription?.current_tier_id).to.equal(existingSubscription.current_tier_id);
			expect(persistedOriginalSubscription?.next_tier_id).to.equal(existingSubscription.next_tier_id);
			expect(persistedOriginalSubscription?.current_period_end?.getTime()).to.equal(
				existingSubscription.current_period_end?.getTime(),
			);
			expect(persistedOriginalSubscription?.last_billing_attempt?.getTime()).to.equal(
				existingSubscription.last_billing_attempt?.getTime(),
			);
		} finally {
			clock.restore();
		}
	});

	it('creates an inactive gift and leaves recipient subscription unchanged when recipient already has a free sub tier', async () => {
		const now = new Date('2024-11-05T00:00:00.000Z');
		const clock = sinon.useFakeTimers({
			now: now.getTime(),
			shouldClearNativeTimers: true,
			toFake: ['Date'],
		});

		try {
			const admin = await createTestAdmin(usersRepo);
			const freeTier = await createTestSubscriptionTier(usersRepo, { tier: 'free', power: 0 });
			const premiumTier = await createTestSubscriptionTier(usersRepo, { tier: 'premium', power: 5 });

			const recipient = await createTestSubscriber(usersRepo, {
				current_tier_id: freeTier.id,
				active_until: null,
			});
			const existingSubscription = recipient.subscription;

			const response = await giftSdk.giftSubscription({
				params: {
					giftToUserId: recipient.id,
					subscriptionTierId: premiumTier.id,
					durationDays: 20,
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

			const persisted = await subscriptionRepo.findById(existingSubscription.id);
			expect(persisted).to.not.be.a('undefined');
			if (!persisted) {
				throw new Error('Subscription not found');
			}

			expect(persisted.current_tier_id).to.equal(freeTier.id);
			expect(persisted.next_tier_id).to.equal(existingSubscription.next_tier_id);
			expect(persisted.billing_period_days).to.equal(0);
			expect(persisted.price_on_purchase_rubles).to.equal(existingSubscription.price_on_purchase_rubles);
			expect(persisted.grace_period_size).to.equal(existingSubscription.grace_period_size);

			const gift = await giftRepo.getByFields({
				giftedBy: admin.id,
				giftedTo: recipient.id,
				tierId: premiumTier.id,
			});
			expect(gift).to.not.be.a('undefined');
			expect(gift?.activated_at).to.equal(null);
			expect(gift?.duration_days).to.equal(20);
		} finally {
			clock.restore();
		}
	});

	it('creates a lower-tier inactive gift without changing current subscription', async () => {
		const now = new Date('2024-11-06T00:00:00.000Z');
		const clock = sinon.useFakeTimers({
			now: now.getTime(),
			shouldClearNativeTimers: true,
			toFake: ['Date'],
		});

		try {
			const admin = await createTestAdmin(usersRepo);
			const premiumTier = await createTestSubscriptionTier(usersRepo, { tier: 'premium', power: 10 });
			const paidTier = await createTestSubscriptionTier(usersRepo, { tier: 'paid', power: 5 });

			const existingPeriodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
			const recipient = await createTestSubscriber(usersRepo, {
				current_tier_id: premiumTier.id,
				active_until: existingPeriodEnd,
			});
			const existingSubscription = recipient.subscription;

			const response = await giftSdk.giftSubscription({
				params: {
					giftToUserId: recipient.id,
					subscriptionTierId: paidTier.id,
					durationDays: 10,
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

			const persisted = await subscriptionRepo.findById(existingSubscription.id);
			expect(persisted).to.not.be.a('undefined');
			if (!persisted) {
				throw new Error('Subscription not found');
			}

			expect(persisted.current_tier_id).to.equal(premiumTier.id);
			expect(persisted.next_tier_id).to.equal(existingSubscription.next_tier_id);
			expect(persisted.current_period_end?.getTime()).to.equal(existingPeriodEnd.getTime());

			// TODO: refactor w/ gift assertions from accept-gift
			const gift = await giftRepo.getByFields({
				giftedBy: admin.id,
				giftedTo: recipient.id,
				tierId: paidTier.id,
			});
			expect(gift).to.not.be.a('undefined');
			expect(gift?.activated_at).to.equal(null);
			expect(gift?.duration_days).to.equal(10);
		} finally {
			clock.restore();
		}
	});

	it('cannot send free tier sub as a gift', async () => {
		const now = new Date('2024-11-06T00:00:00.000Z');
		const clock = sinon.useFakeTimers({
			now: now.getTime(),
			shouldClearNativeTimers: true,
			toFake: ['Date'],
		});
		try {
			const admin = await createTestAdmin(usersRepo);
			const freeTier = await createTestSubscriptionTier(usersRepo, { tier: 'free', power: 0 });
			const premiumTier = await createTestSubscriptionTier(usersRepo, { tier: 'premium', power: 5 });
			const existingPeriodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

			const recipient = await createTestSubscriber(usersRepo, {
				current_tier_id: premiumTier.id,
				active_until: existingPeriodEnd,
			});
			const existingSubscription = recipient.subscription;

			const response = await giftSdk.giftSubscription({
				params: {
					giftToUserId: recipient.id,
					subscriptionTierId: freeTier.id,
					durationDays: 20,
				},
				userMeta: {
					userId: admin.id,
					isAuth: true,
					isWrongAccessJwt: false,
				},
			});

			expect(response.status).to.equal(HttpStatus.BAD_REQUEST);

			const persisted = await subscriptionRepo.findById(existingSubscription.id);
			expect(persisted).to.not.be.a('undefined');
			if (!persisted) {
				throw new Error('Subscription not found');
			}

			expect(persisted.current_tier_id).to.equal(premiumTier.id);
			expect(persisted.next_tier_id).to.equal(existingSubscription.next_tier_id);
			expect(persisted.current_period_end?.getTime()).to.equal(existingPeriodEnd.getTime());
		} finally {
			clock.restore();
		}
	});
});
