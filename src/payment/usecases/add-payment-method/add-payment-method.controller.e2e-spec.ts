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

describe('[E2E] Add payment method usecase', () => {
	let app: INestApplication;

	let usersRepo: UsersTestRepository;
	let paymentSdk: PaymentTestSdk;
	let fakeYookassaClient: FakeYookassaClient;

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
		fakeYookassaClient = app.get(YOOKASSA_CLIENT);
	});

	afterEach(async () => {
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

		const params = fakeYookassaClient.getLastCreatedPaymentMethodParams();
		expect(params).to.not.be.a('undefined');
		if (!params) {
			throw new Error();
		}
		expect(params.metadata.user_id).to.equal(subscriber.id);
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
