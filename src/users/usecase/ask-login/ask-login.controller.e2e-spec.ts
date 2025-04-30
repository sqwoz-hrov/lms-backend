import { INestApplication } from '@nestjs/common';
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
import { createTestUser } from '../../../../test/fixtures/create-test-user.fixture';

describe('[E2E] AskLogin usecase', () => {
	let app: INestApplication;
	let utilRepository: UsersTestRepository;
	let postgresqlContainer: StartedPostgreSqlContainer;
	let redisContainer: StartedRedisContainer;
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

		if (!user) {
			throw new Error('User not found');
		}

		const res = await userTestSdk.askLogin({
			params: {
				email: user.email,
			},
			userMeta: {
				userId: user.id,
				isWrongJwt: false,
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

		if (!user) {
			throw new Error('User not found');
		}

		const res = await userTestSdk.askLogin({
			params: {
				email: user.email,
			},
			userMeta: {
				userId: user.id,
				isWrongJwt: true,
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
				isWrongJwt: false,
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
				isWrongJwt: false,
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
				isWrongJwt: false,
				isAuth: false,
			},
		});
		expect(res.status).to.equal(404);
	});
});
