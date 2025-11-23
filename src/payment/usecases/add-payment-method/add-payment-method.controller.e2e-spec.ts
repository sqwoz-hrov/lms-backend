import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { expect } from 'chai';
import { createTestSubscriber, createTestUser } from '../../../../test/fixtures/user.fixture';
import { ISharedContext } from '../../../../test/setup/test.app-setup';
import { TestHttpClient } from '../../../../test/test.http-client';
import { jwtConfig } from '../../../config';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { UsersTestRepository } from '../../../user/test-utils/test.repo';
import { PaymentTestSdk } from '../../test-utils/test.sdk';
import { YOOKASSA_CLIENT } from '../../../yookassa/constants';
import { FakeYookassaClient } from '../../../yookassa/services/fake-yookassa.client';
import { SubscriptionTestRepository } from '../../../subscription/test-utils/test.repo';

describe('[E2E] Add payment method usecase', () => {
	let app: INestApplication;

	let usersRepo: UsersTestRepository;
	let subscriptionRepo: SubscriptionTestRepository;
	let paymentSdk: PaymentTestSdk;
	let fakeYookassaClient: FakeYookassaClient;

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
		fakeYookassaClient = app.get(YOOKASSA_CLIENT);
	});

	afterEach(async () => {
		await subscriptionRepo.clearAll();
		await usersRepo.clearAll();
		fakeYookassaClient.clearLastCreatedPaymentMethod();
	});

	it('creates payment method confirmation for subscriber', async () => {
		const subscriber = await createTestSubscriber(usersRepo);

		const response = await paymentSdk.addPaymentMethod({
			userMeta: {
				userId: subscriber.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(response.status).to.equal(HttpStatus.CREATED);
		if (response.status !== HttpStatus.CREATED) throw new Error();
		expect(response.body.confirmation_url).to.be.a('string').and.to.have.length.greaterThan(0);

		const createPaymentMethodParams = fakeYookassaClient.getLastCreatedPaymentMethodParams();
		expect(createPaymentMethodParams).to.not.be.a('undefined');
		const createPaymentMethodResponse = fakeYookassaClient.getLastCreatedPaymentMethodResponse();
		expect(createPaymentMethodResponse).to.not.be.a('undefined');
		if (!createPaymentMethodParams || !createPaymentMethodResponse) {
			throw new Error();
		}
		expect(createPaymentMethodParams.type).to.equal('bank_card');

		const storedPaymentMethod = await subscriptionRepo.findPaymentMethod(subscriber.id);
		expect(storedPaymentMethod).to.not.be.a('undefined');
		if (!storedPaymentMethod) {
			throw new Error('payment method not stored');
		}
		expect(storedPaymentMethod.payment_method_id).to.equal(createPaymentMethodResponse.id);
		expect(storedPaymentMethod.status).to.equal('pending');
	});

	it('denies access to non-subscriber roles', async () => {
		const regularUser = await createTestUser(usersRepo);

		const response = await paymentSdk.addPaymentMethod({
			userMeta: {
				userId: regularUser.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(response.status).to.equal(HttpStatus.UNAUTHORIZED);
	});
});
