import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { expect } from 'chai';
import { createTestUser } from '../../../../test/fixtures/user.fixture';
import { ISharedContext } from '../../../../test/setup/test.app-setup';
import { TestHttpClient } from '../../../../test/test.http-client';
import { jwtConfig } from '../../../config';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { UsersTestRepository } from '../../test-utils/test.repo';
import { UsersTestSdk } from '../../test-utils/test.sdk';

describe('[E2E] Get me usecase', () => {
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
		const res = await usersTestSdk.getMe({
			userMeta: {
				isAuth: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Fake jwt gets 401', async () => {
		const user = await createTestUser(utilRepository);

		const res = await usersTestSdk.getMe({
			userMeta: {
				userId: user.id,
				isAuth: true,
				isWrongAccessJwt: true,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Returns current user with all fields', async () => {
		const user = await createTestUser(utilRepository, {
			is_archived: true,
		});

		const res = await usersTestSdk.getMe({
			userMeta: {
				userId: user.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.OK);
		if (res.status != 200) throw new Error();
		expect(res.body.id).to.equal(user.id);
		expect(res.body.role).to.equal('user');
		expect(res.body.name).to.equal(user.name);
		expect(res.body.email).to.equal(user.email);
		expect(res.body.telegram_id).to.equal(user.telegram_id);
		expect(res.body.telegram_username).to.equal(user.telegram_username);
		expect(res.body.is_billable).to.equal(false);
		expect(res.body.is_archived).to.equal(true);
	});
});
