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
		await subscriptionRepo.addActivePaymentMethod({
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
		expect(response.body.nextBillingAt).to.equal(subscriber.subscription.current_period_end?.toISOString());
		expect(response.body.nextBillingAt).not.to.equal(null);
	});

	// Нам нужно пересмотреть понятие billable. Billable - это когда есть привязанная карта, плюс когда текущий уровень платный ИЛИ используется гифт, но после гифта вернётся платный
	it('returns null nextBillingAt when user on free sub tier if user had payment method', async () => {
		const subscriber = await createTestSubscriber(usersRepo);
		await subscriptionRepo.addActivePaymentMethod({
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
		expect(response.body.nextBillingAt).to.equal(null);
	});

	it.fail('returns null nextBillingAt when user on free sub tier if user did not have payment method', async () => {});

	it.fail('gift subscription does not set nextBillingAt if pre-gift was free tier and user had active payment method', async () => {});
	it.fail('gift subscription does not set nextBillingAt if pre-gift was free tier and user did not have active payment method', async () => {});



	it.fail('Returns null nextBillingAt even when gifted paid sub if pre-gift was a paid sub without payment method', async () => {});

	it.fail('If user had failed payments recently, this should be shown in "problemsWithPaymentMehtod" field');

	it('gift subscription increases nextBillingAt if pre-gift was a paid sub with payment method', async () => {
		const subscriber = await createTestSubscriber(usersRepo, { subscription_tier_id: null });
		await subscriptionRepo.addActivePaymentMethod({
			userId: subscriber.id,
			paymentMethodId: 'pm-get-1',
		});

		fakeYookassaClient.registerPaymentMethod({
			id: 'pm-get-1',
			type: 'bank_card',
			saved: true,
			card: { last4: '1234' },
		});

		const initialResponse = await subscriptionSdk.getActivePaymentMethod({
			userMeta: {
				userId: subscriber.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(initialResponse.status).to.equal(HttpStatus.OK);
		if (initialResponse.status !== 200) throw new Error();
		expect(initialResponse.body.nextBillingAt).not.to.equal(null);
		const preGiftNextBillingAt = new Date(initialResponse.body.nextBillingAt!);

		const durationDays = 30;
		const getDurationMs = (days: number) => days * 24 * 60 * 60 * 1000;

		await subscriptionSdk.giftSubscription({
			params: {
				userId: subscriber.id,
				subscriptionTierId: 'tier-basic',
				durationDays,
			},
			userMeta: {
				userId: subscriber.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});
		const postGiftResponse = await subscriptionSdk.getActivePaymentMethod({
			userMeta: {
				userId: subscriber.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});
		expect(postGiftResponse.status).to.equal(HttpStatus.OK);
		if (postGiftResponse.status !== 200) throw new Error();
		const postGiftNextBillingAt = new Date(postGiftResponse.body.nextBillingAt!);
		expect(postGiftNextBillingAt.getTime()).to.be.greaterThanOrEqual(preGiftNextBillingAt.getTime() + getDurationMs(durationDays));
	});

	it('returns null nextBillingAt when billing is not scheduled', async () => {
		const subscriber = await createTestSubscriber(usersRepo, { is_billable: false });
		await subscriptionRepo.addActivePaymentMethod({
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
		expect(response.body.paymentMethodId).to.equal('pm-get-2');
		expect(response.body.nextBillingAt).to.equal(null);
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
