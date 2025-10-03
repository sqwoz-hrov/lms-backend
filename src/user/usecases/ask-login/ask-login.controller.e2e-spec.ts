import { INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { expect } from 'chai';
import { createTestUser } from '../../../../test/fixtures/user.fixture';
import { TestHttpClient } from '../../../../test/test.http-client';
import { ISharedContext } from '../../../../test/setup/test.app-setup';
import { jwtConfig } from '../../../config';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { UsersTestRepository } from '../../test-utils/test.repo';
import { UsersTestSdk } from '../../test-utils/test.sdk';

describe('[E2E] AskLogin usecase', function () {
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

	it('No JWT token works just fine', async () => {
		const insertRes = await utilRepository.connection
			.insertInto('user')
			.returningAll()
			.values({
				role: 'user',
				name: 'testuser',
				telegram_username: 'testuser',
				telegram_id: 123456789,
				email: 'john@doe.com',
			})
			.execute();
		const user = insertRes.at(0);

		if (!user) throw new Error('User not found');

		const res = await userTestSdk.askLogin({
			params: {
				email: user.email,
			},
			userMeta: {
				userId: user.id,
				isWrongAccessJwt: false,
				isAuth: false,
			},
		});

		expect(res.status).to.equal(202);
		expect(res.body).to.deep.equal({});
	});

	it('Wrong JWT token works', async () => {
		const insertRes = await utilRepository.connection
			.insertInto('user')
			.returningAll()
			.values({
				role: 'user',
				name: 'testuser',
				telegram_username: 'testuser',
				telegram_id: 123456789,
				email: 'john@doe.com',
			})
			.execute();

		const user = insertRes.at(0);
		if (!user) throw new Error('User not found');

		const res = await userTestSdk.askLogin({
			params: {
				email: user.email,
			},
			userMeta: {
				userId: user.id,
				isWrongAccessJwt: true,
				isAuth: true,
			},
		});

		expect(res.status).to.equal(202);
		expect(res.body).to.deep.equal({});
	});

	it('Correct JWT token works', async () => {
		const user = await createTestUser(utilRepository);
		const res = await userTestSdk.askLogin({
			params: {
				email: user.email,
			},
			userMeta: {
				userId: user.id,
				isWrongAccessJwt: false,
				isAuth: true,
			},
		});
		expect(res.status).to.equal(202);
	});

	it('Non-existing user returns 404', async () => {
		const user = await createTestUser(utilRepository);
		const res = await userTestSdk.askLogin({
			params: {
				email: 'non-existent@email.com',
			},
			userMeta: {
				userId: user.id,
				isWrongAccessJwt: false,
				isAuth: false,
			},
		});
		expect(res.status).to.equal(404);
	});

	it('User with unfinished registration returns 404', async () => {
		const user = await createTestUser(utilRepository, { telegram_id: undefined });
		const res = await userTestSdk.askLogin({
			params: {
				email: user.email,
			},
			userMeta: {
				userId: user.id,
				isWrongAccessJwt: false,
				isAuth: false,
			},
		});
		expect(res.status).to.equal(404);
	});
});
