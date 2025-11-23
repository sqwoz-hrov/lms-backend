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
import { YOOKASSA_CLIENT } from '../../../yookassa/constants';
import { FakeYookassaClient } from '../../../yookassa/services/fake-yookassa.client';

describe('[E2E] Get active payment method usecase', () => {
	let app: INestApplication;

	let usersRepo: UsersTestRepository;
	let subscriptionRepo: SubscriptionTestRepository;
	let subscriptionSdk: SubscriptionTestSdk;
	let fakeYookassaClient: FakeYookassaClient;

	before(function (this: ISharedContext) {
		app = this.app;
		const dbProvider = app.get(DatabaseProvider);
		usersRepo = new UsersTestRepository(dbProvider);
		subscriptionRepo = new SubscriptionTestRepository(dbProvider);
		fakeYookassaClient = app.get(YOOKASSA_CLIENT);

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
		fakeYookassaClient.clearRegisteredPaymentMethods();
	});

	it('returns stored payment method for subscriber', async () => {
		const subscriber = await createTestSubscriber(usersRepo);
		await subscriptionRepo.upsertPaymentMethod({
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
		expect(response.body.paymentMethodId).to.equal('pm-get-1');
		expect(response.body.type).to.equal('bank_card');
		expect(response.body.last4).to.equal('1234');
		expect(response.body.userId).to.equal(subscriber.id);
	});

	it('returns 404 when payment method is pending activation', async () => {
		const subscriber = await createTestSubscriber(usersRepo);
		await subscriptionRepo.upsertPaymentMethod({
			userId: subscriber.id,
			paymentMethodId: 'pm-pending-1',
			status: 'pending',
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

		const response = await subscriptionSdk.getActivePaymentMethod({
			userMeta: {
				userId: regularUser.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(response.status).to.equal(HttpStatus.UNAUTHORIZED);
	});
});
