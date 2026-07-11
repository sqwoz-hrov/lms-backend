import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { expect } from 'chai';
import { ISharedContext } from '../../../../test/setup/test.app-setup';
import { TestHttpClient } from '../../../../test/test.http-client';
import { createTestSubscriber, createTestUser } from '../../../../test/fixtures/user.fixture';
import { jwtConfig } from '../../../config';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { SubscriptionTestRepository } from '../../../subscription/test-utils/test.repo';
import {
	YookassaPaymentCanceledWebhook,
	YookassaPaymentSucceededWebhook,
} from '../../../subscription/types/yookassa-webhook';
import { UsersTestRepository } from '../../../user/test-utils/test.repo';
import { PaymentTestRepository } from '../../test-utils/test.repo';
import { PaymentTestSdk } from '../../test-utils/test.sdk';

describe('[E2E] List payment history usecase', () => {
	let app: INestApplication;
	let usersRepo: UsersTestRepository;
	let subscriptionRepo: SubscriptionTestRepository;
	let paymentRepo: PaymentTestRepository;
	let paymentSdk: PaymentTestSdk;

	const buildUserMeta = (userId: string) => ({
		userId,
		isAuth: true,
		isWrongAccessJwt: false,
	});

	const buildPaymentSucceededPayload = (params: {
		paymentId: string;
		userId: string;
		currentTierId: string;
		createdAt: Date;
		amount: string;
		paymentMethodId: string;
		last4: string;
	}): YookassaPaymentSucceededWebhook => ({
		event: 'payment.succeeded',
		object: {
			id: params.paymentId,
			status: 'succeeded',
			paid: true,
			amount: {
				value: params.amount,
				currency: 'RUB',
			},
			metadata: {
				user_id: params.userId,
				current_tier_id: params.currentTierId,
			},
			created_at: params.createdAt.toISOString(),
			payment_method: {
				id: params.paymentMethodId,
				type: 'bank_card',
				saved: true,
				card: { last4: params.last4 },
			},
		},
	});

	const buildPaymentCanceledPayload = (params: {
		paymentId: string;
		userId: string;
		currentTierId: string;
		createdAt: Date;
		amount: string;
		paymentMethodId: string;
		last4: string;
	}): YookassaPaymentCanceledWebhook => ({
		event: 'payment.canceled',
		object: {
			id: params.paymentId,
			status: 'canceled',
			paid: false,
			amount: {
				value: params.amount,
				currency: 'RUB',
			},
			metadata: {
				user_id: params.userId,
				current_tier_id: params.currentTierId,
			},
			created_at: params.createdAt.toISOString(),
			canceled_at: params.createdAt.toISOString(),
			payment_method: {
				id: params.paymentMethodId,
				type: 'bank_card',
				saved: true,
				card: { last4: params.last4 },
			},
		},
	});

	before(function (this: ISharedContext) {
		app = this.app;
		const dbProvider = app.get(DatabaseProvider);
		usersRepo = new UsersTestRepository(dbProvider);
		subscriptionRepo = new SubscriptionTestRepository(dbProvider);
		paymentRepo = new PaymentTestRepository(dbProvider);
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

	it('returns current user successful payment events in historical order with pagination', async () => {
		const subscriber = await createTestSubscriber(usersRepo);
		const anotherSubscriber = await createTestSubscriber(usersRepo);

		const oldSuccessfulPayload = buildPaymentSucceededPayload({
			paymentId: 'pay-old',
			userId: subscriber.id,
			currentTierId: subscriber.subscription.current_tier_id,
			createdAt: new Date('2026-01-01T00:00:00.000Z'),
			amount: '1000.00',
			paymentMethodId: 'pm-old',
			last4: '1111',
		});
		const canceledPayload = buildPaymentCanceledPayload({
			paymentId: 'pay-canceled',
			userId: subscriber.id,
			currentTierId: subscriber.subscription.current_tier_id,
			createdAt: new Date('2026-01-02T00:00:00.000Z'),
			amount: '2000.00',
			paymentMethodId: 'pm-canceled',
			last4: '2222',
		});
		const otherUserSuccessfulPayload = buildPaymentSucceededPayload({
			paymentId: 'pay-other-user',
			userId: anotherSubscriber.id,
			currentTierId: anotherSubscriber.subscription.current_tier_id,
			createdAt: new Date('2026-01-03T00:00:00.000Z'),
			amount: '3000.00',
			paymentMethodId: 'pm-other',
			last4: '3333',
		});
		const newSuccessfulPayload = buildPaymentSucceededPayload({
			paymentId: 'pay-new',
			userId: subscriber.id,
			currentTierId: subscriber.subscription.current_tier_id,
			createdAt: new Date('2026-01-04T00:00:00.000Z'),
			amount: '4000.00',
			paymentMethodId: 'pm-new',
			last4: '4444',
		});
		await paymentRepo.insertPaymentEvent({
			user_id: subscriber.id,
			subscription_id: subscriber.subscription.id,
			event: oldSuccessfulPayload,
			created_at: new Date('2026-01-01T00:00:00.000Z'),
		});
		await paymentRepo.insertPaymentEvent({
			user_id: subscriber.id,
			subscription_id: subscriber.subscription.id,
			event: canceledPayload,
			created_at: new Date('2026-01-02T00:00:00.000Z'),
		});
		await paymentRepo.insertPaymentEvent({
			user_id: anotherSubscriber.id,
			subscription_id: anotherSubscriber.subscription.id,
			event: otherUserSuccessfulPayload,
			created_at: new Date('2026-01-03T00:00:00.000Z'),
		});

		await paymentRepo.insertPaymentEvent({
			user_id: subscriber.id,
			subscription_id: subscriber.subscription.id,
			event: newSuccessfulPayload,
			created_at: new Date('2026-01-04T00:00:00.000Z'),
		});


		const firstPage = await paymentSdk.getPaymentHistory({
			params: { page: 1, pageSize: 1 },
			userMeta: buildUserMeta(subscriber.id),
		});

		expect(firstPage.status).to.equal(HttpStatus.OK);
		if (firstPage.status !== HttpStatus.OK) {
			throw new Error('Unexpected response status');
		}

		expect(firstPage.body.items).to.deep.equal([
			{
				paymentMethodName: '4444',
				amount: 4000,
				currency: 'RUB',
				date: '2026-01-04T00:00:00.000Z',
			},
		]);
		expect(firstPage.body.pagination).to.deep.equal({
			page: 1,
			pageSize: 1,
			totalItems: 2,
			totalPages: 2,
			hasNextPage: true,
			hasPreviousPage: false,
		});

		const secondPage = await paymentSdk.getPaymentHistory({
			params: { page: 2, pageSize: 1 },
			userMeta: buildUserMeta(subscriber.id),
		});

		expect(secondPage.status).to.equal(HttpStatus.OK);
		if (secondPage.status !== HttpStatus.OK) {
			throw new Error('Unexpected response status');
		}

		expect(secondPage.body.items).to.deep.equal([
			{
				paymentMethodName: '1111',
				amount: 1000,
				currency: 'RUB',
				date: '2026-01-01T00:00:00.000Z',
			},
		]);
		expect(secondPage.body.pagination).to.deep.equal({
			page: 2,
			pageSize: 1,
			totalItems: 2,
			totalPages: 2,
			hasNextPage: false,
			hasPreviousPage: true,
		});
	});

	it('non-subscriber cannot see payment history', async () => {
		const user = await createTestUser(usersRepo);

		const response = await paymentSdk.getPaymentHistory({
			userMeta: buildUserMeta(user.id),
		});

		expect(response.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('non-authenticated cannot see payment history', async () => {
		const response = await paymentSdk.getPaymentHistory({
			userMeta: { isAuth: false },
		});

		expect(response.status).to.equal(HttpStatus.UNAUTHORIZED);
	});
});
