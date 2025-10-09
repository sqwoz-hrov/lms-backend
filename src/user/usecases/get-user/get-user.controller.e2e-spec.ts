import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { expect } from 'chai';
import { createTestAdmin, createTestUser } from '../../../../test/fixtures/user.fixture';
import { ISharedContext } from '../../../../test/setup/test.app-setup';
import { TestHttpClient } from '../../../../test/test.http-client';
import { jwtConfig } from '../../../config';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { UsersTestRepository } from '../../test-utils/test.repo';
import { UsersTestSdk } from '../../test-utils/test.sdk';

describe('[E2E] Get user by id usecase', () => {
	let app: INestApplication;

	let utilRepository: UsersTestRepository;
	let userTestSdk: UsersTestSdk;

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
		const [user, otherUser] = await Promise.all([
			createTestUser(utilRepository),
			createTestUser(utilRepository),
		]);

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

	it('User can access self', async () => {
		const user = await createTestUser(utilRepository);

		const res = await userTestSdk.getUserById({
			params: { id: user.id },
			userMeta: {
				userId: user.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.OK);
		expect(res.body.id).to.equal(user.id);
		expect(res.body.email).to.equal(user.email);
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
		expect(res.body.id).to.equal(admin.id);
		expect(res.body.role).to.equal('admin');
	});

	it('Admin can access any user', async () => {
		const admin = await createTestAdmin(utilRepository);
		const user = await createTestUser(utilRepository);

		const res = await userTestSdk.getUserById({
			params: { id: user.id },
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.OK);
		expect(res.body.id).to.equal(user.id);
		expect(res.body.email).to.equal(user.email);
	});

	it('Returns 404 when user not found', async () => {
		const admin = await createTestAdmin(utilRepository);

		const res = await userTestSdk.getUserById({
			params: { id: 'non-existing-id' },
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.NOT_FOUND);
	});
});
