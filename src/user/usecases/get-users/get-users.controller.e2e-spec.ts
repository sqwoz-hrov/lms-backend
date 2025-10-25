import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { expect } from 'chai';
import {
	createTestAdmin,
	createTestSubscriber,
	createTestSubscriptionTier,
	createTestUser,
} from '../../../../test/fixtures/user.fixture';
import { ISharedContext } from '../../../../test/setup/test.app-setup';
import { TestHttpClient } from '../../../../test/test.http-client';
import { jwtConfig } from '../../../config';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { UsersTestRepository } from '../../test-utils/test.repo';
import { UsersTestSdk } from '../../test-utils/test.sdk';

describe('[E2E] Get users usecase', () => {
	let app: INestApplication;
	let utilRepository: UsersTestRepository;
	let usersTestSdk: UsersTestSdk;

	before(function (this: ISharedContext) {
		app = this.app;
		const kysely = app.get(DatabaseProvider);
		utilRepository = new UsersTestRepository(kysely);

		usersTestSdk = new UsersTestSdk(
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
		await utilRepository.clearAll();
	});

	it('Unauthenticated gets 401', async () => {
		const res = await usersTestSdk.getUsers({
			userMeta: {
				isAuth: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Fake jwt gets 401', async () => {
		const admin = await createTestAdmin(utilRepository);

		const res = await usersTestSdk.getUsers({
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongAccessJwt: true,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Admin can retrieve full list', async () => {
		const admin = await createTestAdmin(utilRepository);
		const anotherAdmin = await createTestAdmin(utilRepository);
		const userOne = await createTestUser(utilRepository);
		const userTwo = await createTestUser(utilRepository);
		const subscriptionTier = await createTestSubscriptionTier(utilRepository);
		const subscriber = await createTestSubscriber(utilRepository, {
			subscription_tier_id: subscriptionTier.id,
			active_until: new Date('2033-01-01T00:00:00.000Z'),
		});

		const res = await usersTestSdk.getUsers({
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.OK);
		if (res.status != 200) throw new Error();
		expect(res.body).to.be.an('array');

		const returnedIds = res.body.map(user => user.id);

		expect(returnedIds).to.have.members([admin.id, anotherAdmin.id, userOne.id, userTwo.id, subscriber.id]);

		const returnedSubscriber = res.body.find(user => user.id === subscriber.id);
		expect(returnedSubscriber).to.be.an('object');
		expect(returnedSubscriber?.subscription_tier_id).to.equal(subscriber.subscription.subscription_tier_id);
		const expectedActiveUntil = subscriber.subscription.current_period_end
			? subscriber.subscription.current_period_end.toISOString()
			: null;
		expect(returnedSubscriber?.active_until).to.equal(expectedActiveUntil);
		expect(returnedSubscriber?.is_billable).to.equal(!subscriber.subscription.is_gifted);
		expect(returnedSubscriber?.subscription_tier).to.deep.equal({
			id: subscriptionTier.id,
			tier: subscriptionTier.tier,
			power: subscriptionTier.power,
			permissions: subscriptionTier.permissions ?? [],
		});
	});

	it('User sees self and admins only', async () => {
		const adminOne = await createTestAdmin(utilRepository);
		const adminTwo = await createTestAdmin(utilRepository);
		const requestingUser = await createTestUser(utilRepository);
		const otherUser = await createTestUser(utilRepository);

		const res = await usersTestSdk.getUsers({
			userMeta: {
				userId: requestingUser.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.OK);
		if (res.status != 200) throw new Error();
		expect(res.body).to.be.an('array');

		const returnedIds = res.body.map(user => user.id);

		expect(returnedIds).to.have.members([adminOne.id, adminTwo.id, requestingUser.id]);
		expect(returnedIds).to.not.include(otherUser.id);
	});

	it('Subscriber sees only self', async () => {
		await createTestUser(utilRepository);
		const subscriptionTier = await createTestSubscriptionTier(utilRepository);
		const subscriber = await createTestSubscriber(utilRepository, {
			subscription_tier_id: subscriptionTier.id,
			active_until: new Date('2034-05-01T00:00:00.000Z'),
		});

		const res = await usersTestSdk.getUsers({
			userMeta: {
				userId: subscriber.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.OK);
		if (res.status != 200) throw new Error();
		expect(res.body).to.be.an('array').with.lengthOf(1);
		expect(res.body[0].id).to.equal(subscriber.id);
		expect(res.body[0].role).to.equal('subscriber');
		expect(res.body[0].subscription_tier_id).to.equal(subscriber.subscription.subscription_tier_id);
		expect(res.body[0].subscription_tier?.id).to.equal(subscriptionTier.id);
		expect(res.body[0].is_billable).to.equal(!subscriber.subscription.is_gifted);
		const ownActiveUntil = subscriber.subscription.current_period_end
			? subscriber.subscription.current_period_end.toISOString()
			: null;
		expect(res.body[0].active_until).to.equal(ownActiveUntil);
	});
});
