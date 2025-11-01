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
import { UsersTestRepository } from '../../../user/test-utils/test.repo';
import { PaymentTestSdk } from '../../test-utils/test.sdk';

describe('[E2E] Create payment form usecase', () => {
	let app: INestApplication;

	let usersRepo: UsersTestRepository;
	let paymentSdk: PaymentTestSdk;

	before(function (this: ISharedContext) {
		app = this.app;
		const dbProvider = app.get(DatabaseProvider);
		usersRepo = new UsersTestRepository(dbProvider);

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
		await usersRepo.clearAll();
	});

	it('Unauthenticated gets 401', async () => {
		const tier = await createTestSubscriptionTier(usersRepo);

		const res = await paymentSdk.createPaymentForm({
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

		const res = await paymentSdk.createPaymentForm({
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

		const res = await paymentSdk.createPaymentForm({
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

		const res = await paymentSdk.createPaymentForm({
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

	it('Subscriber receives payment form data from YooKassa', async () => {
		const subscriber = await createTestSubscriber(usersRepo);
		const targetTier = await createTestSubscriptionTier(usersRepo, {
			tier: 'premium',
			price_rubles: 2590,
		});

		const res = await paymentSdk.createPaymentForm({
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

		expect(res.body.status).to.equal('pending');
		expect(res.body.paid).to.equal(false);
		expect(res.body.amount_rubles).to.equal(2590);
		expect(res.body.confirmation_url).to.be.a('string');
	});
});
