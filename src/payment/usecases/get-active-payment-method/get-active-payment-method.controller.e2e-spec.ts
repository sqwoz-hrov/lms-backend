import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { expect } from 'chai';
import { ISharedContext } from '../../../../test/setup/test.app-setup';
import { TestHttpClient } from '../../../../test/test.http-client';
import { jwtConfig } from '../../../config';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { UsersTestRepository } from '../../../user/test-utils/test.repo';
import { SubscriptionTestRepository } from '../../../subscription/test-utils/test.repo';
import { SubscriptionTestSdk } from '../../../subscription/test-utils/test.sdk';
import {
	createTestAdmin,
	createTestSubscriber,
	createTestSubscriptionTier,
	createTestUser,
} from '../../../../test/fixtures/user.fixture';
import { YOOKASSA_CLIENT } from '../../../yookassa/constants';
import { FakeYookassaClient } from '../../../yookassa/services/fake-yookassa.client';
import { GiftTestRepository } from '../../../gift/test-utils/test.repo';
import { PaymentTestRepository } from '../../test-utils/test.repo';
import {
	YookassaPaymentCanceledWebhook,
	YookassaPaymentSucceededWebhook,
} from '../../../subscription/types/yookassa-webhook';

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

describe('[E2E] Get active payment method usecase', () => {
	let app: INestApplication;

	let usersRepo: UsersTestRepository;
	let subscriptionRepo: SubscriptionTestRepository;
	let paymentRepo: PaymentTestRepository;
	let subscriptionSdk: SubscriptionTestSdk;
	let fakeYookassaClient: FakeYookassaClient;
	let giftRepo: GiftTestRepository;

	before(function (this: ISharedContext) {
		app = this.app;
		const dbProvider = app.get(DatabaseProvider);
		usersRepo = new UsersTestRepository(dbProvider);
		subscriptionRepo = new SubscriptionTestRepository(dbProvider);
		paymentRepo = new PaymentTestRepository(dbProvider);
		fakeYookassaClient = app.get(YOOKASSA_CLIENT);
		giftRepo = new GiftTestRepository(dbProvider);

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

	beforeEach(async () => {
		await createTestSubscriptionTier(usersRepo, {
			power: 0,
			price_rubles: 0,
			tier: 'FREE BASIC TIER',
		});
	});

	afterEach(async () => {
		await giftRepo.clearAll();
		await subscriptionRepo.clearAll();
		await usersRepo.clearAll();
		fakeYookassaClient.clearRegisteredPaymentMethods();
	});

	it('returns stored payment method for subscriber', async () => {
		const subscriber = await createTestSubscriber(usersRepo);
		const pm = await subscriptionRepo.addActivePaymentMethod({
			userId: subscriber.id,
			paymentMethodId: 'pm-get-1',
		});

		fakeYookassaClient.registerPaymentMethod({
			id: 'pm-get-1',
			type: 'bank_card',
			saved: true,
			card: { last4: '1234' },
		});

		const response = await subscriptionSdk.getActivePaymentMethod({
			userMeta: {
				userId: subscriber.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(response.status).to.equal(HttpStatus.OK);
		if (response.status !== 200) throw new Error();
		expect(response.body.id).to.equal(pm?.id);
		expect(response.body.id).to.not.be.undefined;
		expect(response.body.type).to.equal('bank_card');
		expect(response.body.last4).to.equal('1234');
		expect(response.body.userId).to.equal(subscriber.id);
		expect(response.body.nextBillingAt).to.equal(subscriber.subscription.current_period_end?.toISOString());
		expect(response.body.nextBillingAt).not.to.equal(null);
		expect(response.body.problemsWithPaymentMethod).to.equal(false);
	});

	it('returns 404 when user on free sub tier if user did not have payment method', async () => {
		const freeTier = await createTestSubscriptionTier(usersRepo, {
			power: 0,
			price_rubles: 0,
		});
		const subscriber = await createTestSubscriber(usersRepo, {
			current_tier_id: freeTier.id,
		});

		const response = await subscriptionSdk.getActivePaymentMethod({
			userMeta: {
				userId: subscriber.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(response.status).to.equal(HttpStatus.NOT_FOUND);
	});

	it('returns problemsWithPaymentMethod when latest payment was canceled with active payment method', async () => {
		const subscriber = await createTestSubscriber(usersRepo);
		const pm = await subscriptionRepo.addActivePaymentMethod({
			userId: subscriber.id,
			paymentMethodId: 'pm-get-problems',
		});

		fakeYookassaClient.registerPaymentMethod({
			id: 'pm-get-problems',
			type: 'bank_card',
			saved: true,
			card: { last4: '4321' },
		});

		const successfulPaymentPayload: YookassaPaymentSucceededWebhook = {
			event: 'payment.succeeded',
			object: {
				id: 'pay-succeeded-active-method',
				status: 'succeeded',
				paid: true,
				amount: {
					value: '1500.00',
					currency: 'RUB',
				},
				metadata: {
					user_id: subscriber.id,
					current_tier_id: subscriber.subscription.current_tier_id,
				},
				created_at: new Date('2025-12-01T00:00:00.000Z').toISOString(),
				payment_method: {
					id: 'pm-get-problems',
					type: 'bank_card',
					saved: true,
					card: { last4: '4321' },
				},
			},
		};

		const canceledPaymentPayload: YookassaPaymentCanceledWebhook = {
			event: 'payment.canceled',
			object: {
				id: 'pay-canceled-active-method',
				status: 'canceled',
				paid: false,
				amount: {
					value: '1500.00',
					currency: 'RUB',
				},
				metadata: {
					user_id: subscriber.id,
					current_tier_id: subscriber.subscription.current_tier_id,
				},
				created_at: new Date('2026-01-01T00:00:00.000Z').toISOString(),
				canceled_at: new Date('2026-01-01T00:00:00.000Z').toISOString(),
				payment_method: {
					id: 'pm-get-problems',
					type: 'bank_card',
					saved: true,
					card: { last4: '4321' },
				},
			},
		};

		await paymentRepo.insertPaymentEvent({
			user_id: subscriber.id,
			subscription_id: subscriber.subscription.id,
			event: successfulPaymentPayload,
			created_at: new Date('2025-12-01T00:00:00.000Z'),
		});

		await paymentRepo.insertPaymentEvent({
			user_id: subscriber.id,
			subscription_id: subscriber.subscription.id,
			event: canceledPaymentPayload,
			created_at: new Date('2026-01-01T00:00:00.000Z'),
		});

		const response = await subscriptionSdk.getActivePaymentMethod({
			userMeta: {
				userId: subscriber.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(response.status).to.equal(HttpStatus.OK);
		if (response.status !== 200) throw new Error();
		expect(response.body.id).to.equal(pm?.id);
		expect(response.body.problemsWithPaymentMethod).to.equal(true);
	});

	it("returns null nextBillingAt when user's next tier is free even though his current tier is a paid one and has payment method", async () => {
		const freeTier = await createTestSubscriptionTier(usersRepo, {
			power: 0,
			price_rubles: 0,
		});
		const paidTier = await createTestSubscriptionTier(usersRepo, {
			power: 3,
			price_rubles: 2000,
		});
		const subscriber = await createTestSubscriber(usersRepo, {
			current_tier_id: paidTier.id,
		});

		await usersRepo.connection
			.updateTable('subscription')
			.set({
				next_tier_id: freeTier.id,
			})
			.where('id', '=', subscriber.subscription.id)
			.executeTakeFirstOrThrow();

		const pm = await subscriptionRepo.addActivePaymentMethod({
			userId: subscriber.id,
			paymentMethodId: 'pm-get-2',
		});

		fakeYookassaClient.registerPaymentMethod({
			id: 'pm-get-2',
			type: 'bank_card',
			saved: true,
			card: { last4: '5678' },
		});

		const response = await subscriptionSdk.getActivePaymentMethod({
			userMeta: {
				userId: subscriber.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(response.status).to.equal(HttpStatus.OK);
		if (response.status !== 200) throw new Error();
		expect(response.body.id).to.equal(pm?.id);
		expect(response.body.nextBillingAt).to.equal(null);
	});

	it("returns null nextBillingAt when user's next tier is free and his current tier is free and has payment method", async () => {
		const freeTier = await createTestSubscriptionTier(usersRepo, {
			power: 0,
			price_rubles: 0,
		});
		const subscriber = await createTestSubscriber(usersRepo, {
			current_tier_id: freeTier.id,
		});
		const pm = await subscriptionRepo.addActivePaymentMethod({
			userId: subscriber.id,
			paymentMethodId: 'pm-get-2',
		});

		fakeYookassaClient.registerPaymentMethod({
			id: 'pm-get-2',
			type: 'bank_card',
			saved: true,
			card: { last4: '5678' },
		});

		const response = await subscriptionSdk.getActivePaymentMethod({
			userMeta: {
				userId: subscriber.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(response.status).to.equal(HttpStatus.OK);
		if (response.status !== 200) throw new Error();
		expect(response.body.id).to.equal(pm?.id);
		expect(response.body.id).to.not.be.undefined;
		expect(response.body.type).to.equal('bank_card');
		expect(response.body.last4).to.equal('5678');
		expect(response.body.userId).to.equal(subscriber.id);
		expect(response.body.nextBillingAt).to.equal(null);
	});

	it("returns null nextBillingAt when user's next tier is free and he is on a paid gift tier now and has payment method", async () => {
		const freeTier = await createTestSubscriptionTier(usersRepo, {
			power: 0,
			price_rubles: 0,
		});
		const subscriber = await createTestSubscriber(usersRepo, {
			current_tier_id: freeTier.id,
		});
		const giftTier = await createTestSubscriptionTier(usersRepo, {
			power: 5,
			price_rubles: 1000,
		});
		const pm = await subscriptionRepo.addActivePaymentMethod({
			userId: subscriber.id,
			paymentMethodId: 'pm-get-2',
		});

		fakeYookassaClient.registerPaymentMethod({
			id: 'pm-get-2',
			type: 'bank_card',
			saved: true,
			card: { last4: '5678' },
		});

		// add active gift
		const activatedAt = addDays(new Date(), -5);
		await giftRepo.insertGift({
			gifted_by: subscriber.id,
			gifted_to: subscriber.id,
			tier_id: giftTier.id,
			duration_days: 20,
			activated_at: activatedAt,
		});

		const response = await subscriptionSdk.getActivePaymentMethod({
			userMeta: {
				userId: subscriber.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(response.status).to.equal(HttpStatus.OK);
		if (response.status !== 200) throw new Error();
		expect(response.body.id).to.equal(pm?.id);
		expect(response.body.nextBillingAt).to.equal(null);
	});

	it("returns 404 when no payment method, user's next tier is paid tier and is on a gifted sub for now", async () => {
		const paidTier = await createTestSubscriptionTier(usersRepo, {
			power: 3,
			price_rubles: 3000,
		});
		const giftTier = await createTestSubscriptionTier(usersRepo, {
			power: 5,
			price_rubles: 1000,
		});

		const subscriber = await createTestSubscriber(usersRepo, {
			current_tier_id: paidTier.id,
		});

		// add active gift
		const activatedAt = addDays(new Date(), -5);
		await giftRepo.insertGift({
			gifted_by: subscriber.id,
			gifted_to: subscriber.id,
			tier_id: giftTier.id,
			duration_days: 20,
			activated_at: activatedAt,
		});

		const response = await subscriptionSdk.getActivePaymentMethod({
			userMeta: {
				userId: subscriber.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(response.status).to.equal(HttpStatus.NOT_FOUND);
	});

	it("returns not null nextBillingAt when user's next tier is paid tier and is on a gifted sub for now", async () => {
		const paidTier = await createTestSubscriptionTier(usersRepo, {
			power: 3,
			price_rubles: 3000,
		});
		const subscriber = await createTestSubscriber(usersRepo, {
			current_tier_id: paidTier.id,
		});
		const giftTier = await createTestSubscriptionTier(usersRepo, {
			power: 5,
			price_rubles: 1000,
		});
		const pm = await subscriptionRepo.addActivePaymentMethod({
			userId: subscriber.id,
			paymentMethodId: 'pm-get-2',
		});

		fakeYookassaClient.registerPaymentMethod({
			id: 'pm-get-2',
			type: 'bank_card',
			saved: true,
			card: { last4: '5678' },
		});

		// add active gift
		const activatedAt = addDays(new Date(), -5);
		await giftRepo.insertGift({
			gifted_by: subscriber.id,
			gifted_to: subscriber.id,
			tier_id: giftTier.id,
			duration_days: 20,
			activated_at: activatedAt,
		});

		const response = await subscriptionSdk.getActivePaymentMethod({
			userMeta: {
				userId: subscriber.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(response.status).to.equal(HttpStatus.OK);
		if (response.status !== 200) throw new Error();
		expect(response.body.id).to.equal(pm?.id);
		expect(response.body.nextBillingAt).to.not.equal(null);
	});

	it('returns 404 when payment method is pending activation', async () => {
		const subscriber = await createTestSubscriber(usersRepo);
		await subscriptionRepo.addPendingPaymentMethod({
			userId: subscriber.id,
			paymentMethodId: 'pm-pending-1',
		});

		const response = await subscriptionSdk.getActivePaymentMethod({
			userMeta: {
				userId: subscriber.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(response.status).to.equal(HttpStatus.NOT_FOUND);
		if (response.status !== HttpStatus.NOT_FOUND) {
			throw new Error();
		}
		expect(response.body.description).to.equal('Payment method not found');
	});

	it('returns 404 when payment method missing', async () => {
		const subscriber = await createTestSubscriber(usersRepo);

		const response = await subscriptionSdk.getActivePaymentMethod({
			userMeta: {
				userId: subscriber.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(response.status).to.equal(HttpStatus.NOT_FOUND);
		if (response.status !== 404) throw new Error();
		expect(response.body.description).to.equal('Payment method not found');
	});

	it('denies access to non-subscriber roles', async () => {
		const regularUser = await createTestUser(usersRepo);
		const admin = await createTestAdmin(usersRepo);

		const response = await subscriptionSdk.getActivePaymentMethod({
			userMeta: {
				userId: regularUser.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(response.status).to.equal(HttpStatus.UNAUTHORIZED);

		const adminResponse = await subscriptionSdk.getActivePaymentMethod({
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(adminResponse.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('denies access with improper jwt', async () => {
		const regularUser = await createTestUser(usersRepo);

		const response = await subscriptionSdk.getActivePaymentMethod({
			userMeta: {
				userId: regularUser.id,
				isAuth: true,
				isWrongAccessJwt: true,
			},
		});

		expect(response.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('denies access for unauthenticated', async () => {
		const response = await subscriptionSdk.getActivePaymentMethod({
			userMeta: {
				isAuth: false,
			},
		});

		expect(response.status).to.equal(HttpStatus.UNAUTHORIZED);
	});
});
