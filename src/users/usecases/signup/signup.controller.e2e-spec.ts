import { INestApplication, HttpStatus } from '@nestjs/common';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { StartedRedisContainer } from '@testcontainers/redis';
import { expect } from 'chai';
import { ConfigType } from '@nestjs/config';

import { jwtConfig } from '../../../config';
import { UserModule } from '../../user.module';
import { TelegramModule } from '../../../telegram/telegram.module';
import { UsersTestRepository } from '../../test-utils/test.repo';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { UsersTestSdk } from '../../test-utils/test.sdk';
import { TestHttpClient } from '../../../../test/test.http-client';
import { setupTestApplication } from '../../../../test/test.app-setup';
import {
	createTestUser,
	createTestAdmin,
	createEmail,
	createName,
} from '../../../../test/fixtures/create-test-user.fixture';
import { randomWord } from '../../../../test/fixtures/common.fixture';

describe('[E2E] Signup usecase', () => {
	let app: INestApplication;
	let postgresqlContainer: StartedPostgreSqlContainer;
	let redisContainer: StartedRedisContainer;

	let utilRepository: UsersTestRepository;
	let userTestSdk: UsersTestSdk;

	before(async () => {
		({ app, postgresqlContainer, redisContainer } = await setupTestApplication({
			imports: [UserModule, TelegramModule.forRoot({ useTelegramAPI: false })],
		}));
		const kysely = app.get(DatabaseProvider);
		utilRepository = new UsersTestRepository(kysely);

		await app.init();
		await app.listen(3000);

		userTestSdk = new UsersTestSdk(
			new TestHttpClient({
				port: 3000,
				host: 'http://127.0.0.1',
			}),
			app.get<ConfigType<typeof jwtConfig>>(jwtConfig.KEY),
		);
	});

	afterEach(async () => {
		await utilRepository.clearAll();
	});

	after(async () => {
		await app.close();
		await postgresqlContainer.stop();
		await redisContainer.stop();
	});

	it('Unauthed gets 401', async () => {
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
				isWrongJwt: false,
				isAuth: false,
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
				isWrongJwt: false,
				isAuth: true,
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
				isWrongJwt: true,
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
				isWrongJwt: false,
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
				isWrongJwt: false,
				isAuth: true,
			},
		});
		expect(res.status).to.equal(HttpStatus.CREATED);
		expect(res.body.email).to.equal(user.email);
		expect(res.body.role).to.equal(user.role);
		expect(res.body.telegram_username).to.equal(user.telegram_username);
		expect(res.body.name).to.equal(user.name);
	});
});
