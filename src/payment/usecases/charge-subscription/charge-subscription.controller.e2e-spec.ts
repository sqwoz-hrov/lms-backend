import { HttpStatus, INestApplication } from '@nestjs/common';
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
import { SubscriptionTestRepository } from '../../../subscription/test-utils/test.repo';
import { UserRepository } from '../../../user/user.repository';
import { UsersTestRepository } from '../../../user/test-utils/test.repo';
import { YOOKASSA_CLIENT } from '../../../yookassa/constants';
import { FakeYookassaClient } from '../../../yookassa/services/fake-yookassa.client';
import { HandleYookassaWebhookUsecase } from '../../../yookassa/usecases/handle-yookassa-webhook/handle-yookassa-webhook.usecase';
import { PaymentTestSdk } from '../../test-utils/test.sdk';

describe('[E2E] Charge subscription usecase', () => {
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

	it('Unauthenticated gets 401', async () => {
		const tier = await createTestSubscriptionTier(usersRepo);

		const res = await paymentSdk.chargeSubscription({
			params: {
				current_tier_id: tier.id,
				expectedAmountRubles: tier.price_rubles,
			},
			userMeta: { isAuth: false },
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Fake jwt gets 401', async () => {
		const subscriber = await createTestSubscriber(usersRepo);
		const tier = await createTestSubscriptionTier(usersRepo);

		const res = await paymentSdk.chargeSubscription({
			params: {
				current_tier_id: tier.id,
				expectedAmountRubles: tier.price_rubles,
			},
			userMeta: {
				userId: subscriber.id,
				isAuth: true,
				isWrongAccessJwt: true,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Non-subscriber cannot create payment form', async () => {
		const user = await createTestUser(usersRepo);
		const tier = await createTestSubscriptionTier(usersRepo);

		const res = await paymentSdk.chargeSubscription({
			params: {
				current_tier_id: tier.id,
				expectedAmountRubles: tier.price_rubles,
			},
			userMeta: {
				userId: user.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Returns 400 when the idempotence key is missing', async () => {
		const subscriber = await createTestSubscriber(usersRepo);
		const tier = await createTestSubscriptionTier(usersRepo);

		const res = await paymentSdk.chargeSubscription({
			params: {
				current_tier_id: tier.id,
				expectedAmountRubles: tier.price_rubles,
			},
			userMeta: {
				userId: subscriber.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
			idempotenceKey: null,
		});

		expect(res.status).to.equal(HttpStatus.BAD_REQUEST);
	});

	it('Returns 404 when subscription tier is missing', async () => {
		const subscriber = await createTestSubscriber(usersRepo);
		const missingTierId = randomUUID();

		const res = await paymentSdk.chargeSubscription({
			params: {
				current_tier_id: missingTierId,
				expectedAmountRubles: 0,
			},
			userMeta: {
				userId: subscriber.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.NOT_FOUND);
		if (res.status !== HttpStatus.NOT_FOUND) throw new Error();
		expect(res.body.description).to.equal('Subscription tier not found');
	});

	it('Returns 404 when subscription tier is archived', async () => {
		const subscriber = await createTestSubscriber(usersRepo);
		const archivedTier = await createTestSubscriptionTier(usersRepo, {
			tier: 'archived-charge-tier',
			is_archived: true,
			price_rubles: 2990,
		});

		const res = await paymentSdk.chargeSubscription({
			params: {
				current_tier_id: archivedTier.id,
				expectedAmountRubles: archivedTier.price_rubles,
			},
			userMeta: {
				userId: subscriber.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.NOT_FOUND);
		if (res.status !== HttpStatus.NOT_FOUND) throw new Error();
		expect(res.body.description).to.equal('Subscription tier not found');
	});

	it('Returns 404 when payment method is missing', async () => {
		const freeTier = await createTestSubscriptionTier(usersRepo, { power: 0, price_rubles: 0 });
		const subscriber = await createTestSubscriber(usersRepo, { current_tier_id: freeTier.id });
		const tier = await createTestSubscriptionTier(usersRepo);

		const res = await paymentSdk.chargeSubscription({
			params: {
				current_tier_id: tier.id,
				expectedAmountRubles: tier.price_rubles,
			},
			userMeta: {
				userId: subscriber.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.NOT_FOUND);
		if (res.status !== HttpStatus.NOT_FOUND) throw new Error();
		expect(res.body.description).to.equal('Payment method not found');
	});

	it('Returns 400 when subscription tier is not billable', async () => {
		const subscriber = await createTestSubscriber(usersRepo);
		const freeTier = await createTestSubscriptionTier(usersRepo, {
			price_rubles: 0,
		});

		await subscriptionRepo.addActivePaymentMethod({
			userId: subscriber.id,
			paymentMethodId: 'pm-free-tier',
		});

		const res = await paymentSdk.chargeSubscription({
			params: {
				current_tier_id: freeTier.id,
				expectedAmountRubles: freeTier.price_rubles,
			},
			userMeta: {
				userId: subscriber.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.BAD_REQUEST);
		if (res.status !== HttpStatus.BAD_REQUEST) throw new Error();
		expect(res.body.description).to.equal('Subscription tier is not billable');
	});

	it('Returns 400 when trying to charge for a cheaper subscription tier', async () => {
		const subscriber = await createTestSubscriber(usersRepo);
		const cheaperTierPrice = Math.max(1, subscriber.subscription_tier.price_rubles - 100);
		const cheaperTier = await createTestSubscriptionTier(usersRepo, {
			tier: 'cheaper-tier',
			price_rubles: cheaperTierPrice,
			power: subscriber.subscription_tier.power - 1,
		});

		await subscriptionRepo.addActivePaymentMethod({
			userId: subscriber.id,
			paymentMethodId: 'pm-cheapest-tier',
		});

		const res = await paymentSdk.chargeSubscription({
			params: {
				current_tier_id: cheaperTier.id,
				expectedAmountRubles: cheaperTier.price_rubles,
			},
			userMeta: {
				userId: subscriber.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.BAD_REQUEST);
		if (res.status !== HttpStatus.BAD_REQUEST) throw new Error();
		expect(res.body.description).to.equal(
			`Cannot downgrade subscription tier from "${subscriber.subscription_tier.tier}" to "${cheaperTier.tier}"`,
		);
	});

	it('Charges for a paid tier below the active gifted tier and keeps the gift active', async () => {
		const baseTier = await createTestSubscriptionTier(usersRepo, {
			tier: 'gifted-purchase-base',
			price_rubles: 0,
			power: 0,
		});
		const targetTier = await createTestSubscriptionTier(usersRepo, {
			tier: 'gifted-purchase-paid',
			price_rubles: 1490,
			power: 1,
		});
		const giftedTier = await createTestSubscriptionTier(usersRepo, {
			tier: 'gifted-purchase-premium',
			price_rubles: 2990,
			power: 2,
		});
		const admin = await createTestAdmin(usersRepo);
		const subscriber = await createTestSubscriber(usersRepo, { current_tier_id: baseTier.id });

		await createTestActiveGift(usersRepo, {
			giftedTo: subscriber.id,
			giftedBy: admin.id,
			tierId: giftedTier.id,
		});
		await subscriptionRepo.addActivePaymentMethod({
			userId: subscriber.id,
			paymentMethodId: 'pm-gifted-lower-tier',
		});

		const res = await paymentSdk.chargeSubscription({
			params: {
				current_tier_id: targetTier.id,
				expectedAmountRubles: targetTier.price_rubles,
			},
			userMeta: {
				userId: subscriber.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.CREATED);
		if (res.status !== HttpStatus.CREATED) throw new Error();
		expect(res.body.amountRubles).to.equal(targetTier.price_rubles);
		expect(res.body.paid).to.equal(true);

		const subscriberWithGift = await userRepository.findByIdWithSubscriptionTier(subscriber.id);
		expect(subscriberWithGift?.subscription?.is_gifted).to.equal(true);
		expect(subscriberWithGift?.subscription_tier?.id).to.equal(giftedTier.id);
	});

	it('Returns 400 when trying to charge for a subscription tier that is already purchased', async () => {
		const activeTier = await createTestSubscriptionTier(usersRepo, {
			tier: 'already-purchased-tier',
			price_rubles: 1990,
		});
		const subscriber = await createTestSubscriber(usersRepo, { current_tier_id: activeTier.id });

		await subscriptionRepo.addActivePaymentMethod({
			userId: subscriber.id,
			paymentMethodId: 'pm-same-tier',
		});

		const res = await paymentSdk.chargeSubscription({
			params: {
				current_tier_id: subscriber.subscription_tier.id,
				expectedAmountRubles: 0,
			},
			userMeta: {
				userId: subscriber.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.BAD_REQUEST);
		if (res.status !== HttpStatus.BAD_REQUEST) throw new Error();
		expect(res.body.description).to.equal('Subscription tier already purchased');
	});

	it('Subscriber is charged with saved payment method for new subscription', async () => {
		const freeTier = await createTestSubscriptionTier(usersRepo, { power: 0, price_rubles: 0 });
		const subscriber = await createTestSubscriber(usersRepo, { current_tier_id: freeTier.id });
		const idempotenceKey = randomUUID();
		const targetTier = await createTestSubscriptionTier(usersRepo, {
			tier: 'premium',
			price_rubles: 2590,
		});

		await subscriptionRepo.addActivePaymentMethod({
			userId: subscriber.id,
			paymentMethodId: 'pm-charge-1',
		});

		const res = await paymentSdk.chargeSubscription({
			params: {
				current_tier_id: targetTier.id,
				expectedAmountRubles: targetTier.price_rubles,
			},
			userMeta: {
				userId: subscriber.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
			idempotenceKey,
		});

		expect(res.status).to.equal(HttpStatus.CREATED);
		if (res.status !== HttpStatus.CREATED) throw new Error();
		expect(res.body.paymentId).to.be.a('string');
		expect(res.body.amountRubles).to.equal(targetTier.price_rubles);
		expect(res.body.paid).to.equal(true);
		expect(res.body.status).to.be.a('string');
		if (res.body.confirmationUrl !== undefined) {
			expect(res.body.confirmationUrl).to.be.a('string');
		}
		expect(fakeYookassaClient.getLastChargeParams()?.idempotenceKey).to.equal(idempotenceKey);
	});
	it('charges unused paid time and starts a new period on webhook', async () => {
		const current = await createTestSubscriptionTier(usersRepo, { price_rubles: 1000 });
		const target = await createTestSubscriptionTier(usersRepo, { price_rubles: 2000 });
		const subscriber = await createTestSubscriber(usersRepo, {
			current_tier_id: current.id,
			active_until: new Date(Date.now() + 15 * 86400000),
		});
		await subscriptionRepo.update(subscriber.subscription.id, { price_on_purchase_rubles: 12 });
		await subscriptionRepo.addActivePaymentMethod({ userId: subscriber.id, paymentMethodId: 'pm-discount' });
		const idempotenceKey = randomUUID();
		const request = {
			params: { current_tier_id: target.id, expectedAmountRubles: 1502 },
			userMeta: { userId: subscriber.id, isAuth: true, isWrongAccessJwt: false },
			idempotenceKey,
		};
		const res = await paymentSdk.chargeSubscription(request);
		expect(res.status).to.equal(HttpStatus.CREATED);
		if (res.status !== HttpStatus.CREATED) throw new Error();
		expect(res.body.amountRubles).to.equal(1502);
		const charge = fakeYookassaClient.getLastChargeParams()!;
		expect(charge.metadata.purchase_mode).to.equal('upgrade_discount');
		await app.get(HandleYookassaWebhookUsecase).execute({
			event: 'payment.succeeded',
			object: {
				id: res.body.paymentId,
				status: 'succeeded',
				paid: true,
				created_at: res.body.createdAt,
				amount: { value: String(res.body.amountRubles), currency: 'RUB' },
				metadata: charge.metadata,
			},
		});
		const updated = await subscriptionRepo.findById(subscriber.subscription.id);
		expect(updated?.current_tier_id).to.equal(target.id);
		expect(updated?.current_period_end?.getTime()).to.equal(new Date(res.body.createdAt).getTime() + 30 * 86400000);
		expect(updated?.price_on_purchase_rubles).to.equal(res.body.amountRubles);
	});

	it('does not charge when the confirmed amount has changed', async () => {
		const current = await createTestSubscriptionTier(usersRepo, { price_rubles: 1000 });
		const target = await createTestSubscriptionTier(usersRepo, { price_rubles: 2000 });
		const subscriber = await createTestSubscriber(usersRepo, { current_tier_id: current.id });
		const res = await paymentSdk.chargeSubscription({
			params: { current_tier_id: target.id, expectedAmountRubles: 0 },
			userMeta: { userId: subscriber.id, isAuth: true, isWrongAccessJwt: false },
		});
		expect(res.status).to.equal(HttpStatus.CONFLICT);
		expect(fakeYookassaClient.getLastChargeParams()).to.be.undefined;
		expect((await subscriptionRepo.findById(subscriber.subscription.id))?.current_tier_id).to.equal(current.id);
	});

	it('rejects zero or negative charges without creating gifts', async () => {
		const current = await createTestSubscriptionTier(usersRepo, { price_rubles: 1000 });
		const target = await createTestSubscriptionTier(usersRepo, { price_rubles: 2000 });
		const subscriber = await createTestSubscriber(usersRepo, {
			current_tier_id: current.id,
			active_until: new Date(Date.now() + 90.5 * 86400000),
		});
		const res = await paymentSdk.chargeSubscription({
			params: { current_tier_id: target.id, expectedAmountRubles: -1015 },
			userMeta: { userId: subscriber.id, isAuth: true, isWrongAccessJwt: false },
		});
		expect(res.status).to.equal(HttpStatus.BAD_REQUEST);
		expect(fakeYookassaClient.getLastChargeParams()).to.be.undefined;
		expect(await giftRepo.getByFields({ giftedBy: subscriber.id, giftedTo: subscriber.id, tierId: target.id })).to.be
			.undefined;
	});
});
