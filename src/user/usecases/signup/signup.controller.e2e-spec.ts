import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { expect } from 'chai';
import { randomWord } from '../../../../test/fixtures/common.fixture';
import { createEmail, createName, createTestAdmin, createTestUser } from '../../../../test/fixtures/user.fixture';
import { TestHttpClient } from '../../../../test/test.http-client';
import { ISharedContext } from '../../../../test/test.app-setup';
import { jwtConfig } from '../../../config';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { UsersTestRepository } from '../../test-utils/test.repo';
import { UsersTestSdk } from '../../test-utils/test.sdk';

describe('[E2E] Signup usecase', () => {
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
		const requestAuthor = await createTestUser(utilRepository);
		const user = await createTestUser(utilRepository);

		const res = await userTestSdk.signUp({
			params: {
				email: user.email,
				role: user.role,
				telegram_username: user.telegram_username,
				name: user.name,
			},
			userMeta: {
				userId: requestAuthor.id,
				isWrongAccessJwt: false,
				isAuth: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Fake jwt get 401', async () => {
		const requestAuthor = await createTestAdmin(utilRepository);
		const user = await createTestUser(utilRepository);

		const res = await userTestSdk.signUp({
			params: {
				email: user.email,
				role: user.role,
				telegram_username: user.telegram_username,
				name: user.name,
			},
			userMeta: {
				userId: requestAuthor.id,
				isWrongAccessJwt: true,
				isAuth: true,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Non-admin gets 401', async () => {
		const requestAuthor = await createTestUser(utilRepository);
		const user = await createTestUser(utilRepository);

		const res = await userTestSdk.signUp({
			params: {
				email: user.email,
				role: user.role,
				telegram_username: user.telegram_username,
				name: user.name,
			},
			userMeta: {
				userId: requestAuthor.id,
				isWrongAccessJwt: false,
				isAuth: true,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Admin can create user', async () => {
		const requestAuthor = await createTestAdmin(utilRepository);

		const user = {
			role: 'user',
			name: createName(),
			telegram_username: randomWord(),
			email: createEmail(),
		} as const;
		const res = await userTestSdk.signUp({
			params: {
				...user,
			},
			userMeta: {
				userId: requestAuthor.id,
				isWrongAccessJwt: false,
				isAuth: true,
			},
		});
		expect(res.status).to.equal(HttpStatus.CREATED);
		expect(res.body.email).to.equal(user.email);
		expect(res.body.role).to.equal(user.role);
		expect(res.body.telegram_username).to.equal(user.telegram_username);
		expect(res.body.name).to.equal(user.name);
	});

	it('Admin can create admin', async () => {
		const requestAuthor = await createTestAdmin(utilRepository);

		const user = {
			role: 'admin',
			name: createName(),
			telegram_username: randomWord(),
			email: createEmail(),
		} as const;

		const res = await userTestSdk.signUp({
			params: {
				...user,
			},
			userMeta: {
				userId: requestAuthor.id,
				isWrongAccessJwt: false,
				isAuth: true,
			},
		});
		expect(res.status).to.equal(HttpStatus.CREATED);
		expect(res.body.email).to.equal(user.email);
		expect(res.body.role).to.equal(user.role);
		expect(res.body.telegram_username).to.equal(user.telegram_username);
		expect(res.body.name).to.equal(user.name);
	});

	it('Returns 400 when trying to sign up with duplicate email', async () => {
		const requestAuthor = await createTestAdmin(utilRepository);

		const duplicateEmail = createEmail();
		await createTestUser(utilRepository, {
			email: duplicateEmail,
		});

		const user2 = {
			role: 'user',
			name: createName(),
			email: duplicateEmail,
			telegram_username: randomWord(),
		} as const;

		const secondRes = await userTestSdk.signUp({
			params: user2,
			userMeta: {
				userId: requestAuthor.id,
				isWrongAccessJwt: false,
				isAuth: true,
			},
		});

		expect(secondRes.status).to.equal(HttpStatus.BAD_REQUEST);
	});
});
