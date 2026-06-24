import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { randomUUID } from 'node:crypto';
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
} from '../../../../test/fixtures/user.fixture';
import { GiftTestRepository } from '../../test-utils/test.repo';
import { GiftTestSdk } from '../../test-utils/test.sdk';
import { GiftAggregation } from '../../gift.entity';
import { Kysely, sql } from 'kysely';
import { UserRepository } from '../../../user/user.repository';

describe('[E2E] Gift subscription usecase', () => {
	let app: INestApplication;

	let usersRepo: UsersTestRepository;
	let roUsersRepo: Pick<UserRepository, 'findByIdWithSubscriptionTier' | 'findAll' | 'findById'>;
	let subscriptionRepo: SubscriptionTestRepository;
	let giftRepo: GiftTestRepository;
	let giftSdk: GiftTestSdk;
	let db: Kysely<GiftAggregation>;

	const DAY_MS = 24 * 60 * 60 * 1000;

	before(function () {
		const context = this as ISharedContext;
		app = context.app;
		const dbProvider = app.get(DatabaseProvider);
		db = dbProvider.getDatabase<GiftAggregation>();
		usersRepo = new UsersTestRepository(dbProvider);
		roUsersRepo = new UserRepository(dbProvider);
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
		await giftRepo.clearAll();
		await usersRepo.clearAll();
	});

	const buildUserMeta = (userId: string) => ({
		userId,
		isAuth: true,
		isWrongAccessJwt: false,
	});

	async function withFakeClock(isoNow: string, action: () => Promise<void>): Promise<void>;
	async function withFakeClock(clock: sinon.SinonFakeTimers, action: () => Promise<void>): Promise<void>;
	async function withFakeClock(param: string | sinon.SinonFakeTimers, action: () => Promise<void>): Promise<void> {
		let clock: sinon.SinonFakeTimers;
		if (typeof param === 'string') {
			clock = sinon.useFakeTimers({
				now: new Date(param).getTime(),
				shouldClearNativeTimers: true,
				toFake: ['Date'],
			});
		} else {
			clock = param;
		}

		try {
			await action();
		} finally {
			clock.restore();
		}
	};

	const createGiftViaApi = async (params: {
		giftedBy: string;
		giftedTo: string;
		tierId: string;
		durationDays?: number;
	}) => {
		const response = await giftSdk.giftSubscription({
			params: {
				giftToUserId: params.giftedTo,
				subscriptionTierId: params.tierId,
				durationDays: params.durationDays,
			},
			userMeta: buildUserMeta(params.giftedBy),
		});

		expect(response.status).to.equal(HttpStatus.CREATED);
		if (response.status !== HttpStatus.CREATED) {
			throw new Error('Gift creation request failed');
		}

		const gift = await giftRepo.getByFields({
			giftedBy: params.giftedBy,
			giftedTo: params.giftedTo,
			tierId: params.tierId,
		});

		expect(gift).to.not.equal(undefined);
		if (!gift) {
			throw new Error('Gift was not persisted');
		}

		return gift;
	};

	const getGiftById = async (giftId: string) => {
		return await db.selectFrom('gift').selectAll().where('id', '=', giftId).limit(1).executeTakeFirst();
	};

	const assertGiftNotActivated = async (giftId: string) => {
		const persistedGift = await getGiftById(giftId);
		if (!persistedGift) {
			throw new Error('Gift not created');
		}
		expect(persistedGift.activated_at).to.equal(null);
	};

	const assertGiftActivated = async (giftId: string) => {
		const persistedGift = await getGiftById(giftId);
		const [activatedAt, durationDays] = [persistedGift?.activated_at, persistedGift?.duration_days];
		if (!activatedAt || !durationDays) {
			throw new Error('Gift is not activated');
		}

		// expect that expiry date is in the future (i. e. gift is still active)
		const giftExpiry = new Date(activatedAt.getTime() + durationDays * DAY_MS).getTime();
		const now = new Date().getTime();

		expect(giftExpiry).to.be.greaterThanOrEqual(now);
	};

	const getSubscriptionOrThrow = async (subscriptionId: string) => {
		const sub = await subscriptionRepo.findById(subscriptionId);
		expect(sub).to.not.equal(undefined);
		if (!sub) {
			throw new Error('Subscription not found');
		}

		const extendedSubMeta = await roUsersRepo.findByIdWithSubscriptionTier(sub?.user_id);

		expect(extendedSubMeta?.subscription).to.not.equal(undefined);
		if (!extendedSubMeta?.subscription) {
			throw new Error('Subscription not found');
		}

		return {
			...extendedSubMeta.subscription,
			tierMeta: extendedSubMeta.subscription_tier,
		};
	};

	const assertPeriodMovedByDays = (before: Date | null, after: Date | null, days: number) => {
		if (!before || !after) {
			throw new Error('Expected both period end values to be non-null');
		}
		expect(after.getTime()).to.equal(before.getTime() + days * DAY_MS);
	};

	it('rejects non-subscriber actor', async () => {
		const now = new Date('2026-02-01T00:00:00.000Z');

		await withFakeClock(now.toISOString(), async () => {
			const admin = await createTestAdmin(usersRepo);
			const recipient = await createTestSubscriber(usersRepo);
			const tier = await createTestSubscriptionTier(usersRepo, { tier: 'gift-tier', power: 10 });

			const gift = await createGiftViaApi({
				giftedBy: admin.id,
				giftedTo: recipient.id,
				tierId: tier.id,
				durationDays: 20,
			});

			await usersRepo.updateUser(recipient.id, { role: 'user' });

			const response = await giftSdk.acceptGiftSubscription({
				params: { giftId: gift.id },
				userMeta: buildUserMeta(recipient.id),
			});

			expect(response.status).to.equal(HttpStatus.UNAUTHORIZED);
			if (response.status !== HttpStatus.UNAUTHORIZED) {
				throw new Error('Unexpected response status');
			}
			expect(response.body.description).to.equal('Access denied: role not allowed');

			await assertGiftNotActivated(gift.id);
		});
	});

	it('does not allow claiming another user\'s gift', async () => {
		await withFakeClock('2026-02-02T00:00:00.000Z', async () => {
			const admin = await createTestAdmin(usersRepo);
			const tier = await createTestSubscriptionTier(usersRepo, { tier: 'gift-tier-other-user', power: 11 });
			const recipient = await createTestSubscriber(usersRepo);
			const anotherSubscriber = await createTestSubscriber(usersRepo);

			const gift = await createGiftViaApi({
				giftedBy: admin.id,
				giftedTo: recipient.id,
				tierId: tier.id,
				durationDays: 15,
			});

			const response = await giftSdk.acceptGiftSubscription({
				params: { giftId: gift.id },
				userMeta: buildUserMeta(anotherSubscriber.id),
			});

			expect(response.status).to.equal(HttpStatus.NOT_FOUND);
			if (response.status !== HttpStatus.NOT_FOUND) {
				throw new Error('Unexpected response status');
			}
			expect(response.body.description).to.equal('Gift not found');

			await assertGiftNotActivated(gift.id);
		});
	});

	it('returns 404 for non-existing gift id', async () => {
		await withFakeClock('2026-02-03T00:00:00.000Z', async () => {
			const recipient = await createTestSubscriber(usersRepo);

			const response = await giftSdk.acceptGiftSubscription({
				params: { giftId: randomUUID() },
				userMeta: buildUserMeta(recipient.id),
			});

			expect(response.status).to.equal(HttpStatus.NOT_FOUND);
			if (response.status !== HttpStatus.NOT_FOUND) {
				throw new Error('Unexpected response status');
			}
			expect(response.body.description).to.equal('Gift not found');
		});
	});

	it('rejects accepting second gift while first gifted subscription is still active', async () => {
		const now = new Date();
		await withFakeClock(now.toISOString(), async () => {
			const admin = await createTestAdmin(usersRepo);
			const recipient = await createTestSubscriber(usersRepo);

			const firstTier = await createTestSubscriptionTier(usersRepo, { tier: 'gift-tier-active-first', power: 12 });
			const secondTier = await createTestSubscriptionTier(usersRepo, { tier: 'gift-tier-active-second', power: 13 });

			const firstGift = await createGiftViaApi({
				giftedBy: admin.id,
				giftedTo: recipient.id,
				tierId: firstTier.id,
				durationDays: 7,
			});

			const firstAccept = await giftSdk.acceptGiftSubscription({
				params: { giftId: firstGift.id },
				userMeta: buildUserMeta(recipient.id),
			});
			expect(firstAccept.status).to.equal(HttpStatus.ACCEPTED);

			const secondGift = await createGiftViaApi({
				giftedBy: admin.id,
				giftedTo: recipient.id,
				tierId: secondTier.id,
				durationDays: 5,
			});

			const secondAccept = await giftSdk.acceptGiftSubscription({
				params: { giftId: secondGift.id },
				userMeta: buildUserMeta(recipient.id),
			});

			expect(secondAccept.status).to.equal(HttpStatus.BAD_REQUEST);
			if (secondAccept.status !== HttpStatus.BAD_REQUEST) {
				throw new Error('Unexpected response status');
			}
			expect(secondAccept.body.description).to.equal('Already have an active gifted subscription');

			await assertGiftNotActivated(secondGift.id);
			await assertGiftActivated(firstGift.id);
		});
	});

	it('cannot activate an already expired gift', async () => {
		const now = new Date();
		const clock = sinon.useFakeTimers({
			now: now.getTime(),
			shouldClearNativeTimers: true,
			toFake: ['Date'],
		});

		await withFakeClock(clock, async () => {
			const admin = await createTestAdmin(usersRepo);
			const recipient = await createTestSubscriber(usersRepo);
			const tier = await createTestSubscriptionTier(usersRepo, { tier: 'gift-tier-expired-reactivation', power: 14 });

			const giftDurationDays = 3;
			const gift = await createGiftViaApi({
				giftedBy: admin.id,
				giftedTo: recipient.id,
				tierId: tier.id,
				durationDays: giftDurationDays,
			});

			const firstAccept = await giftSdk.acceptGiftSubscription({
				params: { giftId: gift.id },
				userMeta: buildUserMeta(recipient.id),
			});
			expect(firstAccept.status).to.equal(HttpStatus.ACCEPTED);

			const afterFirstAcceptSub = await getSubscriptionOrThrow(recipient.subscription.id);
			expect(afterFirstAcceptSub.is_gifted).to.equal(true);

			clock.tick((giftDurationDays + 1) * DAY_MS);
			await db.updateTable('gift').set({ activated_at: sql`activated_at - interval '8 day'` }).where('id', '=', gift.id).execute();

			const expiredGift = await getGiftById(gift.id);
			const beforeSecondAcceptSub = await getSubscriptionOrThrow(recipient.subscription.id);
			expect(beforeSecondAcceptSub.is_gifted).to.equal(false);

			const secondAccept = await giftSdk.acceptGiftSubscription({
				params: { giftId: gift.id },
				userMeta: buildUserMeta(recipient.id),
			});

			expect(secondAccept.status).to.equal(HttpStatus.CONFLICT);
			if (secondAccept.status !== HttpStatus.CONFLICT) {
				throw new Error('Unexpected response status');
			}
			expect(secondAccept.body.description).to.equal('Gift already activated');

			const afterSecondAcceptSub = await getSubscriptionOrThrow(recipient.subscription.id);
			const afterSecondAcceptGift = await getGiftById(gift.id);

			// assert times are same and current sub isn't gifted since the gifted expired
			expect(afterSecondAcceptSub.current_period_end?.getTime()).to.equal(beforeSecondAcceptSub.current_period_end?.getTime());
			expect(afterSecondAcceptGift?.activated_at?.getTime()).to.equal(expiredGift?.activated_at?.getTime());
			expect(afterSecondAcceptSub.is_gifted).to.equal(false);
		});
	});

	it('does not activate the same gift twice', async () => {
		const now = new Date();
		await withFakeClock(now.toISOString(), async () => {
			const admin = await createTestAdmin(usersRepo);
			const recipient = await createTestSubscriber(usersRepo);
			const tier = await createTestSubscriptionTier(usersRepo, { tier: 'gift-tier-idempotency', power: 16 });

			const giftDurationDays = 6;
			const gift = await createGiftViaApi({
				giftedBy: admin.id,
				giftedTo: recipient.id,
				tierId: tier.id,
				durationDays: giftDurationDays,
			});

			const before = await getSubscriptionOrThrow(recipient.subscription.id);
			expect(before.is_gifted).to.equal(false);

			const firstAccept = await giftSdk.acceptGiftSubscription({
				params: { giftId: gift.id },
				userMeta: buildUserMeta(recipient.id),
			});

			expect(firstAccept.status).to.equal(HttpStatus.ACCEPTED);
			if (firstAccept.status !== HttpStatus.ACCEPTED) {
				throw new Error('Unexpected response status');
			}

			const afterFirstAcceptSub = await getSubscriptionOrThrow(recipient.subscription.id);
			const afterFirstGift = await getGiftById(gift.id);
			assertPeriodMovedByDays(before.current_period_end, afterFirstAcceptSub.current_period_end, giftDurationDays);
			await assertGiftActivated(gift.id);
			expect(afterFirstAcceptSub.is_gifted).to.equal(true);

			const secondAccept = await giftSdk.acceptGiftSubscription({
				params: { giftId: gift.id },
				userMeta: buildUserMeta(recipient.id),
			});

			expect(secondAccept.status).to.equal(HttpStatus.BAD_REQUEST);
			if (secondAccept.status !== HttpStatus.BAD_REQUEST) {
				throw new Error('Unexpected response status');
			}
			expect(secondAccept.body.description).to.equal('Already have an active gifted subscription');

			const afterSecondAcceptSub = await getSubscriptionOrThrow(recipient.subscription.id);
			const afterSecondGift = await getGiftById(gift.id);
			
			// assert the times haven't move also
			expect(afterSecondAcceptSub.current_period_end?.getTime()).to.equal(afterFirstAcceptSub.current_period_end?.getTime());
			expect(afterSecondGift?.activated_at?.getTime()).to.equal(afterFirstGift?.activated_at?.getTime());

			expect(afterSecondAcceptSub.is_gifted).to.equal(true);
		});
	});

	it('allows accepting a new gift when previous gift is already expired', async () => {
		const now = new Date();
		const clock = sinon.useFakeTimers({
			now: now.getTime(),
			shouldClearNativeTimers: true,
			toFake: ['Date'],
		});

		await withFakeClock(clock, async () => {
			const admin = await createTestAdmin(usersRepo);
			const recipient = await createTestSubscriber(usersRepo);

			const firstTier = await createTestSubscriptionTier(usersRepo, { tier: 'gift-tier-expired-first', power: 14 });
			const secondTier = await createTestSubscriptionTier(usersRepo, { tier: 'gift-tier-expired-second', power: 15 });

			const firstGiftDuration = 3;
			const firstGift = await createGiftViaApi({
				giftedBy: admin.id,
				giftedTo: recipient.id,
				tierId: firstTier.id,
				durationDays: firstGiftDuration,
			});

			const firstAccept = await giftSdk.acceptGiftSubscription({
				params: { giftId: firstGift.id },
				userMeta: buildUserMeta(recipient.id),
			});
			expect(firstAccept.status).to.equal(HttpStatus.ACCEPTED);

			const afterAcceptingFirst = await getSubscriptionOrThrow(recipient.subscription.id);
			expect(afterAcceptingFirst.is_gifted).to.equal(true);

			// skip 4 days so gift is expired
			// expiration is based on DB time, so we'l have to be a bit dirty
			// the 'clock' bit is unnecessary
			clock.tick(4 * DAY_MS);
			await db.updateTable('gift').set({ activated_at: sql`activated_at - interval '8 day'` }).where('id', '=', firstGift.id).execute();

			const secondGiftDuration = 8;
			const secondGift = await createGiftViaApi({
				giftedBy: admin.id,
				giftedTo: recipient.id,
				tierId: secondTier.id,
				durationDays: secondGiftDuration,
			});

			// gift not yet activated, it is merely waiting
			const beforeSecondGift = await getSubscriptionOrThrow(recipient.subscription.id);
			expect(beforeSecondGift.is_gifted).to.equal(false);

			const secondAccept = await giftSdk.acceptGiftSubscription({
				params: { giftId: secondGift.id },
				userMeta: buildUserMeta(recipient.id),
			});

			const after = await getSubscriptionOrThrow(recipient.subscription.id);

			expect(secondAccept.status).to.equal(HttpStatus.ACCEPTED);
			if (secondAccept.status !== HttpStatus.ACCEPTED) {
				throw new Error('Unexpected response status');
			}

			assertPeriodMovedByDays(beforeSecondGift.current_period_end, after.current_period_end, secondGiftDuration);

			await assertGiftActivated(secondGift.id);
			expect(after.is_gifted).to.equal(true);
		});
	});

	it('rejects lower-tier gift acceptance', async () => {
		await withFakeClock('2026-02-06T00:00:00.000Z', async () => {
			const admin = await createTestAdmin(usersRepo);
			const higherTier = await createTestSubscriptionTier(usersRepo, { tier: 'tier-high', power: 50 });
			const lowerTier = await createTestSubscriptionTier(usersRepo, { tier: 'tier-low', power: 10 });

			const recipient = await createTestSubscriber(usersRepo, {
				current_tier_id: higherTier.id,
				active_until: new Date('2026-04-01T00:00:00.000Z'),
			});

			const gift = await createGiftViaApi({
				giftedBy: admin.id,
				giftedTo: recipient.id,
				tierId: lowerTier.id,
				durationDays: 10,
			});

			const response = await giftSdk.acceptGiftSubscription({
				params: { giftId: gift.id },
				userMeta: buildUserMeta(recipient.id),
			});

			expect(response.status).to.equal(HttpStatus.BAD_REQUEST);
			if (response.status !== HttpStatus.BAD_REQUEST) {
				throw new Error('Unexpected response status');
			}
			expect(response.body.description).to.equal('Cannot accept a lower tier gift');

			await assertGiftNotActivated(gift.id);
		});
	});

	it('accepts same-tier gift, moves billing date, keeps current and next tiers unchanged, and activates gift', async () => {
		const now = new Date();
		await withFakeClock(now.toISOString(), async () => {
			const admin = await createTestAdmin(usersRepo);
			const sameTier = await createTestSubscriptionTier(usersRepo, { tier: 'tier-same', power: 20 });
			const recipient = await createTestSubscriber(usersRepo, {
				current_tier_id: sameTier.id,
			});

			const giftDurationDays = 20;
			const gift = await createGiftViaApi({
				giftedBy: admin.id,
				giftedTo: recipient.id,
				tierId: sameTier.id,
				durationDays: giftDurationDays,
			});

			const before = await getSubscriptionOrThrow(recipient.subscription.id);
			expect(before.is_gifted).to.equal(false);

			const response = await giftSdk.acceptGiftSubscription({
				params: { giftId: gift.id },
				userMeta: buildUserMeta(recipient.id),
			});

			expect(response.status).to.equal(HttpStatus.ACCEPTED);
			if (response.status !== HttpStatus.ACCEPTED) {
				throw new Error('Unexpected response status');
			}
			expect(response.body.giftTierId).to.equal(sameTier.id);

			const activatedAt = new Date(response.body.activateAt);
			const activeUntil = new Date(response.body.activeUntil);
			expect(activeUntil.getTime() - activatedAt.getTime()).to.equal(giftDurationDays * DAY_MS);

			const after = await getSubscriptionOrThrow(recipient.subscription.id);
			assertPeriodMovedByDays(before.current_period_end, after.current_period_end, giftDurationDays);

			// assert that we haven't actually changed the database value of current_tier_id
			const { current_tier_id: afterTierIdFromDb } = await subscriptionRepo.findById(recipient.subscription.id) ?? {};
			expect(afterTierIdFromDb).to.equal(before.current_tier_id);
			expect(afterTierIdFromDb).to.equal(sameTier.id);

			// assert that a user's sub view shows gifted tier
			expect(after.current_tier_id).to.equal(sameTier.id);

			// assert we haven't changed the following period's sub tier
			expect(after.next_tier_id).to.equal(before.next_tier_id);
			expect(after.next_tier_id).to.equal(sameTier.id);

			await assertGiftActivated(gift.id);
			expect(after.is_gifted).to.equal(true);
		});
	});

	it('accepts higher-tier gift, moves billing date, keeps current and next tiers unchanged, and activates gift', async () => {
		const now = new Date();
		await withFakeClock(now.toISOString(), async () => {
			const admin = await createTestAdmin(usersRepo);

			const currentTier = await createTestSubscriptionTier(usersRepo, { tier: 'tier-current', power: 5 });
			const higherTier = await createTestSubscriptionTier(usersRepo, { tier: 'tier-higher', power: 30 });

			const recipient = await createTestSubscriber(usersRepo, {
				current_tier_id: currentTier.id,
			});

			const giftDurationDays = 12;
			const gift = await createGiftViaApi({
				giftedBy: admin.id,
				giftedTo: recipient.id,
				tierId: higherTier.id,
				durationDays: giftDurationDays,
			});

			const before = await getSubscriptionOrThrow(recipient.subscription.id);
			expect(before.is_gifted).to.equal(false);

			const response = await giftSdk.acceptGiftSubscription({
				params: { giftId: gift.id },
				userMeta: buildUserMeta(recipient.id),
			});


			expect(response.status).to.equal(HttpStatus.ACCEPTED);
			if (response.status !== HttpStatus.ACCEPTED) {
				throw new Error('Unexpected response status');
			}
			expect(response.body.giftTierId).to.equal(higherTier.id);

			const after = await getSubscriptionOrThrow(recipient.subscription.id);
			assertPeriodMovedByDays(before.current_period_end, after.current_period_end, giftDurationDays);

			// assert that we haven't actually changed the database value of current_tier_id
			const { current_tier_id: afterTierIdFromDb } = await subscriptionRepo.findById(recipient.subscription.id) ?? {};
			expect(afterTierIdFromDb).to.equal(before.current_tier_id);
			expect(afterTierIdFromDb).to.equal(currentTier.id);

			// assert that a user's sub view shows gifted tier
			expect(after.current_tier_id).to.equal(higherTier.id);

			// assert we haven't changed the following period's sub tier
			expect(after.next_tier_id).to.equal(before.next_tier_id);
			expect(after.next_tier_id).to.equal(currentTier.id);

			// assert that the new user sub is a gift
			await assertGiftActivated(gift.id);
			expect(after.is_gifted).to.equal(true);
		});
	});
});
