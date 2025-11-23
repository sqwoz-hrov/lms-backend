import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { expect } from 'chai';
import { v7 } from 'uuid';
import { createTestAdmin, createTestSubscriptionTier, createTestUser } from '../../../../test/fixtures/user.fixture';
import { ISharedContext } from '../../../../test/setup/test.app-setup';
import { TestHttpClient } from '../../../../test/test.http-client';
import { jwtConfig } from '../../../config';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { UsersTestRepository } from '../../../user/test-utils/test.repo';
import { SubscriptionTiersTestSdk } from '../../test-utils/test.sdk';

describe('[E2E] Update subscription tier usecase', () => {
	let app: INestApplication;

	let userUtilRepository: UsersTestRepository;
	let subscriptionTierTestSdk: SubscriptionTiersTestSdk;

	before(function (this: ISharedContext) {
		app = this.app;
		const kysely = app.get(DatabaseProvider);
		userUtilRepository = new UsersTestRepository(kysely);

		subscriptionTierTestSdk = new SubscriptionTiersTestSdk(
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
		await userUtilRepository.clearAll();
	});

	it('Unauthenticated request gets 401', async () => {
		const tier = await createTestSubscriptionTier(userUtilRepository);

		const res = await subscriptionTierTestSdk.updateSubscriptionTier({
			params: {
				id: tier.id,
				tier: 'Updated tier',
			},
			userMeta: {
				isAuth: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Fake JWT gets 401', async () => {
		const admin = await createTestAdmin(userUtilRepository);
		const tier = await createTestSubscriptionTier(userUtilRepository);

		const res = await subscriptionTierTestSdk.updateSubscriptionTier({
			params: {
				id: tier.id,
				tier: 'Updated tier',
			},
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongAccessJwt: true,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Non-admin gets 401', async () => {
		const user = await createTestUser(userUtilRepository);
		const tier = await createTestSubscriptionTier(userUtilRepository);

		const res = await subscriptionTierTestSdk.updateSubscriptionTier({
			params: {
				id: tier.id,
				tier: 'Updated tier',
			},
			userMeta: {
				userId: user.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Admin can update a subscription tier successfully', async () => {
		const admin = await createTestAdmin(userUtilRepository);
		const tier = await createTestSubscriptionTier(userUtilRepository, {
			permissions: ['materials:read'],
			price_rubles: 1000,
			power: 1,
			tier: 'Basic',
		});

		const updatedName = 'Premium';
		const updatedPower = tier.power + 5;
		const updatedPrice = tier.price_rubles + 500;
		const updatedPermissions = ['tasks:read', 'subjects:manage'];

		const res = await subscriptionTierTestSdk.updateSubscriptionTier({
			params: {
				id: tier.id,
				tier: updatedName,
				power: updatedPower,
				price_rubles: updatedPrice,
				permissions: updatedPermissions,
			},
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.OK);
		if (res.status !== HttpStatus.OK) throw new Error();
		expect(res.body.id).to.equal(tier.id);
		expect(res.body.tier).to.equal(updatedName);
		expect(res.body.power).to.equal(updatedPower);
		expect(res.body.price_rubles).to.equal(updatedPrice);
		expect(res.body.permissions).to.deep.equal(updatedPermissions);
	});

	it('Editing non-existing subscription tier returns 404', async () => {
		const admin = await createTestAdmin(userUtilRepository);

		const res = await subscriptionTierTestSdk.updateSubscriptionTier({
			params: {
				id: v7(),
				tier: 'Ghost tier',
			},
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.NOT_FOUND);
	});
});
