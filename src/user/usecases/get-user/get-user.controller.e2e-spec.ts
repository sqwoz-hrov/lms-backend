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
import { UserResponseDto } from '../../dto/user.dto';
import { UsersTestRepository } from '../../test-utils/test.repo';
import { UsersTestSdk } from '../../test-utils/test.sdk';
import { UserWithSubscriptionTier } from '../../user.entity';

describe('[E2E] Get user by id usecase', () => {
	let app: INestApplication;

	let utilRepository: UsersTestRepository;
	let userTestSdk: UsersTestSdk;

	const toExpectedUserResponse = (
		user: UserWithSubscriptionTier,
		overrides: Partial<UserResponseDto> = {},
	): UserResponseDto => ({
		id: user.id,
		role: user.role,
		name: user.name,
		email: user.email,
		telegram_id: user.telegram_id ?? undefined,
		telegram_username: user.telegram_username,
		subscription_tier_id: user.subscription_tier_id ?? null,
		active_until: user.active_until ? new Date(user.active_until).toISOString() : null,
		is_billable: user.is_billable ?? false,
		is_archived: user.is_archived ?? false,
		subscription_tier: user.subscription_tier ?? null,
		...overrides,
	});

	before(function (this: ISharedContext) {
		app = this.app;
		const kysely = app.get(DatabaseProvider);
		utilRepository = new UsersTestRepository(kysely);

		userTestSdk = new UsersTestSdk(
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
		const user = await createTestUser(utilRepository);

		const res = await userTestSdk.getUserById({
			params: { id: user.id },
			userMeta: {
				userId: user.id,
				isAuth: false,
				isWrongAccessJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Fake jwt gets 401', async () => {
		const user = await createTestUser(utilRepository);

		const res = await userTestSdk.getUserById({
			params: { id: user.id },
			userMeta: {
				userId: user.id,
				isAuth: true,
				isWrongAccessJwt: true,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('User cannot access other user', async () => {
		const [user, otherUser] = await Promise.all([createTestUser(utilRepository), createTestUser(utilRepository)]);

		const res = await userTestSdk.getUserById({
			params: { id: otherUser.id },
			userMeta: {
				userId: user.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('User can access self and receives all user fields', async () => {
		const user = await createTestUser(utilRepository, {
			is_billable: false,
			is_archived: true,
		});

		const res = await userTestSdk.getUserById({
			params: { id: user.id },
			userMeta: {
				userId: user.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.OK);
		if (res.status != 200) throw new Error();
		expect(res.body).to.deep.equal(toExpectedUserResponse(user));
	});

	it('User can access admin', async () => {
		const admin = await createTestAdmin(utilRepository);
		const user = await createTestUser(utilRepository);

		const res = await userTestSdk.getUserById({
			params: { id: admin.id },
			userMeta: {
				userId: user.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.OK);
		if (res.status != 200) throw new Error();
		expect(res.body).to.deep.equal(toExpectedUserResponse(admin));
	});

	it('Admin can access subscriber with billing details', async () => {
		const admin = await createTestAdmin(utilRepository);
		const subscriptionTier = await createTestSubscriptionTier(utilRepository, {
			permissions: ['view_dashboard'],
		});
		const user = await createTestSubscriber(utilRepository, {
			subscription_tier_id: subscriptionTier.id,
			active_until: new Date('2035-01-01T00:00:00.000Z'),
			is_billable: true,
		});

		const res = await userTestSdk.getUserById({
			params: { id: user.id },
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.OK);
		if (res.status != 200) throw new Error();
		expect(res.body).to.deep.equal(
			toExpectedUserResponse(user, {
				subscription_tier: {
					id: subscriptionTier.id,
					tier: subscriptionTier.tier,
					permissions: subscriptionTier.permissions ?? [],
				},
			}),
		);
	});

	it('Admin can access non-billable subscriber', async () => {
		const admin = await createTestAdmin(utilRepository);
		const subscriber = await createTestSubscriber(utilRepository, {
			is_billable: true,
		});

		const res = await userTestSdk.getUserById({
			params: { id: subscriber.id },
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.OK);
		if (res.status != 200) throw new Error();
		expect(res.body).to.deep.equal(toExpectedUserResponse(subscriber));
	});

	it('Returns 404 when user not found', async () => {
		const admin = await createTestAdmin(utilRepository);

		const res = await userTestSdk.getUserById({
			params: { id: '00000000-0000-0000-0000-000000000000' },
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.NOT_FOUND);
	});
});
