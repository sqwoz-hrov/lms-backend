import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { expect } from 'chai';
import { randomUUID } from 'crypto';
import {
	createTestSubscriber,
	createTestSubscriptionTier,
	createTestUser,
} from '../../../../test/fixtures/user.fixture';
import { ISharedContext } from '../../../../test/setup/test.app-setup';
import { TestHttpClient } from '../../../../test/test.http-client';
import { jwtConfig } from '../../../config';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { SubscriptionTestRepository } from '../../../subscription/test-utils/test.repo';
import { UsersTestRepository } from '../../../user/test-utils/test.repo';
import { PaymentTestSdk } from '../../test-utils/test.sdk';

describe('[E2E] Charge subscription usecase', () => {
	let app: INestApplication;

	let usersRepo: UsersTestRepository;
	let subscriptionRepo: SubscriptionTestRepository;
	let paymentSdk: PaymentTestSdk;

	before(function (this: ISharedContext) {
		app = this.app;
		const dbProvider = app.get(DatabaseProvider);
		usersRepo = new UsersTestRepository(dbProvider);
		subscriptionRepo = new SubscriptionTestRepository(dbProvider);

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
		await subscriptionRepo.clearAll();
		await usersRepo.clearAll();
	});

	it('Unauthenticated gets 401', async () => {
		const tier = await createTestSubscriptionTier(usersRepo);

		const res = await paymentSdk.chargeSubscription({
			params: {
				subscription_tier_id: tier.id,
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
				subscription_tier_id: tier.id,
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
				subscription_tier_id: tier.id,
			},
			userMeta: {
				userId: user.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Returns 404 when subscription tier is missing', async () => {
		const subscriber = await createTestSubscriber(usersRepo);
		const missingTierId = randomUUID();

		const res = await paymentSdk.chargeSubscription({
			params: {
				subscription_tier_id: missingTierId,
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
		const subscriber = await createTestSubscriber(usersRepo);
		const tier = await createTestSubscriptionTier(usersRepo);

		const res = await paymentSdk.chargeSubscription({
			params: {
				subscription_tier_id: tier.id,
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
				subscription_tier_id: freeTier.id,
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
				subscription_tier_id: cheaperTier.id,
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

	it('Returns 400 when trying to charge for a subscription tier that is already purchased', async () => {
		const activeTier = await createTestSubscriptionTier(usersRepo, {
			tier: 'already-purchased-tier',
			price_rubles: 1990,
		});
		const subscriber = await createTestSubscriber(usersRepo, { subscription_tier_id: activeTier.id });

		await subscriptionRepo.addActivePaymentMethod({
			userId: subscriber.id,
			paymentMethodId: 'pm-same-tier',
		});

		const res = await paymentSdk.chargeSubscription({
			params: {
				subscription_tier_id: subscriber.subscription_tier.id,
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
		const subscriber = await createTestSubscriber(usersRepo);
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
				subscription_tier_id: targetTier.id,
			},
			userMeta: {
				userId: subscriber.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
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
	});
});
