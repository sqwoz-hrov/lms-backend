import { INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { expect } from 'chai';
import { randomUUID } from 'crypto';
import {
	createTestActiveGift,
	createTestAdmin,
	createTestSubscriber,
	createTestSubscriptionTier,
	createTestUser,
} from '../../../../test/fixtures/user.fixture';
import { ISharedContext } from '../../../../test/setup/test.app-setup';
import { TestHttpClient } from '../../../../test/test.http-client';
import { jwtConfig } from '../../../config';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { GiftTestRepository } from '../../../gift/test-utils/test.repo';
import { SubscriptionRepository } from '../../../subscription/subscription.repository';
import { SubscriptionTestRepository } from '../../../subscription/test-utils/test.repo';
import { UserRepository } from '../../../user/user.repository';
import { UsersTestRepository } from '../../../user/test-utils/test.repo';
import { YOOKASSA_CLIENT } from '../../../yookassa/constants';
import { FakeYookassaClient } from '../../../yookassa/services/fake-yookassa.client';
import { AcceptGiftedSubscriptionUsecase } from '../../../gift/usecases/accept-gifted-subscription/accept-gifted-subscription.usecase';
import { PaymentTestSdk } from '../../test-utils/test.sdk';

describe('[E2E] Obtain subscription gift', () => {
	let app: INestApplication;

	let usersRepo: UsersTestRepository;
	let userRepository: UserRepository;
	let subscriptionRepo: SubscriptionTestRepository;
	let giftRepo: GiftTestRepository;
	let paymentSdk: PaymentTestSdk;
	let fakeYookassaClient: FakeYookassaClient;

	before(function (this: ISharedContext) {
		app = this.app;
		const dbProvider = app.get(DatabaseProvider);
		usersRepo = new UsersTestRepository(dbProvider);
		userRepository = new UserRepository(dbProvider);
		subscriptionRepo = new SubscriptionTestRepository(dbProvider);
		giftRepo = new GiftTestRepository(dbProvider);
		fakeYookassaClient = app.get(YOOKASSA_CLIENT);

		paymentSdk = new PaymentTestSdk(
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
		await giftRepo.clearAll();
		await subscriptionRepo.clearAll();
		await usersRepo.clearAll();
		fakeYookassaClient.clearLastCharge();
	});

	async function recordPayment(userId: string, subscriptionId: string, amount: number, event = 'payment.succeeded') {
		await app.get(SubscriptionRepository).insertPaymentEvent({
			user_id: userId,
			subscription_id: subscriptionId,
			event: { event, object: { id: randomUUID(), amount: { value: String(amount), currency: 'RUB' } } },
		});
	}

	async function prepare(days = 90.5, giftDays = 0, paidRubles = 3000) {
		const current = await createTestSubscriptionTier(usersRepo, { price_rubles: 1000, power: 1 });
		const target = await createTestSubscriptionTier(usersRepo, { price_rubles: 1400, power: 2 });
		const subscriber = await createTestSubscriber(usersRepo, {
			current_tier_id: current.id,
			active_until: new Date(Date.now() + days * 86400000),
		});
		if (paidRubles > 0) await recordPayment(subscriber.id, subscriber.subscription.id, paidRubles);
		if (giftDays) {
			await createTestActiveGift(usersRepo, {
				giftedTo: subscriber.id,
				giftedBy: (await createTestAdmin(usersRepo)).id,
				tierId: target.id,
			});
		}
		return {
			subscriber,
			target,
			request: {
				params: { current_tier_id: target.id },
				userMeta: { userId: subscriber.id, isAuth: true, isWrongAccessJwt: false },
			},
		};
	}

	it('requires a subscriber and a valid idempotence key', async () => {
		const { request } = await prepare();
		expect((await paymentSdk.obtainGift({ ...request, userMeta: { isAuth: false } })).status).to.equal(401);
		const user = await createTestUser(usersRepo);
		expect(
			(
				await paymentSdk.obtainGift({
					...request,
					userMeta: { userId: user.id, isAuth: true, isWrongAccessJwt: false },
				})
			).status,
		).to.equal(401);
		expect((await paymentSdk.obtainGift({ ...request, idempotenceKey: null })).status).to.equal(400);
	});

	it('creates inactive self-gifts repeatedly within the allowance without changing expiry', async () => {
		const { subscriber, target, request } = await prepare();
		const before = await subscriptionRepo.findById(subscriber.subscription.id);
		const first = await paymentSdk.obtainGift(request);
		const second = await paymentSdk.obtainGift(request);
		expect(first.status).to.equal(201);
		expect(second.status).to.equal(201);
		if (first.status !== 201 || second.status !== 201) throw new Error();
		expect(first.body.giftId).not.to.equal(second.body.giftId);
		expect(first.body.durationDays).to.equal(30);
		expect((await paymentSdk.obtainGift(request)).status).to.equal(409);
		const after = await subscriptionRepo.findById(subscriber.subscription.id);
		expect(after?.current_period_end).to.deep.equal(before?.current_period_end);
		expect(after?.current_tier_id).to.equal(before?.current_tier_id);
		expect(await app.get(SubscriptionRepository).getSelfGiftAllowance(subscriber.id)).to.equal(200);
		const gift = await giftRepo.getByFields({ giftedBy: subscriber.id, giftedTo: subscriber.id, tierId: target.id });
		expect(gift?.activated_at).to.equal(null);
		expect(gift?.duration_days).to.equal(30);
		expect(fakeYookassaClient.getLastChargeParams()).to.be.undefined;
	});

	it('replays a claim without spending allowance twice', async () => {
		const { subscriber, request } = await prepare();
		const retryable = { ...request, idempotenceKey: randomUUID() };
		const first = await paymentSdk.obtainGift(retryable);
		const retry = await paymentSdk.obtainGift(retryable);
		expect(first.status).to.equal(201);
		expect(retry.body).to.deep.equal(first.body);
		expect(await app.get(SubscriptionRepository).getSelfGiftAllowance(subscriber.id)).to.equal(1600);
	});

	it('serializes concurrent claims with different keys', async () => {
		const { subscriber, request } = await prepare(60.5, 0, 2000);
		const results = await Promise.all([paymentSdk.obtainGift(request), paymentSdk.obtainGift(request)]);
		expect(results.map(result => result.status).sort()).to.deep.equal([201, 409]);
		expect(await app.get(SubscriptionRepository).getSelfGiftAllowance(subscriber.id)).to.equal(600);
	});

	it('ignores the active gift tier and excludes its time from credit', async () => {
		const { subscriber, request } = await prepare(60.5, 30);
		expect((await paymentSdk.obtainGift(request)).status).to.equal(409);
		const activeGift = await userRepository.findByIdWithSubscriptionTier(subscriber.id);
		expect(activeGift?.subscription?.is_gifted).to.equal(true);
	});

	it('can obtain the active gift tier without changing that active gift', async () => {
		const { subscriber, request } = await prepare(90.5, 30);
		const before = await usersRepo.connection
			.selectFrom('gift')
			.selectAll()
			.where('gifted_to', '=', subscriber.id)
			.execute();
		expect((await paymentSdk.obtainGift(request)).status).to.equal(201);
		const after = await usersRepo.connection
			.selectFrom('gift')
			.selectAll()
			.where('gifted_to', '=', subscriber.id)
			.execute();
		expect(after.find(gift => gift.id === before[0].id)).to.deep.equal(before[0]);
		expect(after).to.have.length(2);
	});

	it('activates a special gift through the ordinary gift flow', async () => {
		const { subscriber, target, request } = await prepare();
		const obtained = await paymentSdk.obtainGift(request);
		if (obtained.status !== 201) throw new Error();
		const before = await subscriptionRepo.findById(subscriber.subscription.id);
		const recipient = await userRepository.findByIdWithSubscriptionTier(subscriber.id);
		const activated = await app
			.get(AcceptGiftedSubscriptionUsecase)
			.execute({ giftRecipient: recipient!, giftId: obtained.body.giftId });
		expect(activated?.giftTierId).to.equal(target.id);
		const after = await subscriptionRepo.findById(subscriber.subscription.id);
		expect(after?.current_period_end?.getTime()).to.equal(before!.current_period_end!.getTime() + 30 * 86400000);
		expect(await app.get(SubscriptionRepository).getSelfGiftAllowance(subscriber.id)).to.equal(1600);
	});

	it('requires real successful payments even when remaining days cover the tier', async () => {
		const { subscriber, request } = await prepare(90.5, 0, 0);
		await recordPayment(subscriber.id, subscriber.subscription.id, 10000, 'payment.canceled');
		expect((await paymentSdk.obtainGift(request)).status).to.equal(409);
		await recordPayment(subscriber.id, subscriber.subscription.id, 1400);
		expect((await paymentSdk.obtainGift(request)).status).to.equal(201);
		expect((await paymentSdk.obtainGift(request)).status).to.equal(409);
	});

	it('does not restore allowance when a self-gift expires or its remaining duration shrinks', async () => {
		const { subscriber, target, request } = await prepare(90.5, 0, 1400);
		await giftRepo.insertGift({
			gifted_to: subscriber.id,
			gifted_by: subscriber.id,
			tier_id: target.id,
			activated_at: new Date(Date.now() - 10 * 86400000),
			duration_days: 1,
		});
		expect((await paymentSdk.obtainGift(request)).status).to.equal(409);
		expect(await app.get(SubscriptionRepository).getSelfGiftAllowance(subscriber.id)).to.equal(0);
	});

	it('derives allowance from all self-gifts even without claim events and ignores ordinary gifts', async () => {
		const { subscriber, target, request } = await prepare(90.5, 0, 2800);
		const admin = await createTestAdmin(usersRepo);
		for (const giftedBy of [subscriber.id, admin.id]) {
			await giftRepo.insertGift({
				gifted_to: subscriber.id,
				gifted_by: giftedBy,
				tier_id: target.id,
				activated_at: null,
				duration_days: 30,
			});
		}
		expect((await paymentSdk.obtainGift(request)).status).to.equal(201);
		expect((await paymentSdk.obtainGift(request)).status).to.equal(409);
	});

	it('uses cumulative successful payments without resetting previously obtained gifts', async () => {
		const { subscriber, request } = await prepare(90.5, 0, 1400);
		expect((await paymentSdk.obtainGift(request)).status).to.equal(201);
		expect((await paymentSdk.obtainGift(request)).status).to.equal(409);
		await recordPayment(subscriber.id, subscriber.subscription.id, 1399);
		expect((await paymentSdk.obtainGift(request)).status).to.equal(409);
		await recordPayment(subscriber.id, subscriber.subscription.id, 1);
		expect((await paymentSdk.obtainGift(request)).status).to.equal(201);
	});

	it('rejects missing and archived tiers', async () => {
		const { request } = await prepare();
		expect((await paymentSdk.obtainGift({ ...request, params: { current_tier_id: randomUUID() } })).status).to.equal(
			404,
		);
		const archived = await createTestSubscriptionTier(usersRepo, { is_archived: true });
		expect((await paymentSdk.obtainGift({ ...request, params: { current_tier_id: archived.id } })).status).to.equal(
			404,
		);
	});
});
