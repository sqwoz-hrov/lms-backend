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
import { createTestSubscriber, createTestUser } from '../../../../test/fixtures/user.fixture';

describe('[E2E] Delete payment method usecase', () => {
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

	it('deletes existing payment method for subscriber', async () => {
		const subscriber = await createTestSubscriber(usersRepo);
		await subscriptionRepo.upsertPaymentMethod({
			userId: subscriber.id,
			paymentMethodId: 'pm-delete-1',
		});

		const response = await subscriptionSdk.deletePaymentMethod({
			userMeta: {
				userId: subscriber.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(response.status).to.equal(HttpStatus.NO_CONTENT);

		const paymentMethod = await subscriptionRepo.findPaymentMethod(subscriber.id);
		expect(paymentMethod).to.be.a('undefined');
	});

	it('returns 404 when payment method missing', async () => {
		const subscriber = await createTestSubscriber(usersRepo);

		const response = await subscriptionSdk.deletePaymentMethod({
			userMeta: {
				userId: subscriber.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(response.status).to.equal(HttpStatus.NOT_FOUND);
		expect(response.body.description).to.equal('Payment method not found');
	});

	it('denies access to non-subscriber roles', async () => {
		const regularUser = await createTestUser(usersRepo);

		const response = await subscriptionSdk.deletePaymentMethod({
			userMeta: {
				userId: regularUser.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(response.status).to.equal(HttpStatus.UNAUTHORIZED);
	});
});
