import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';
import { expect } from 'chai';

import { UserModule } from '../../user.module';
import { TelegramModule } from '../../../telegram/telegram.module';
import { runMigrations } from '../../../../test/test.run-migrations';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { dbConfig, jwtConfig, otpBotConfig, otpConfig, redisConfig } from '../../../config';
import { UsersTestRepository } from '../../test-utils/test.repo';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { UsersTestSdk } from '../../test-utils/test.sdk';
import { TestHttpClient } from '../../../../test/test.http-client';
import { InfraModule } from '../../../infra/infra.module';

describe('[E2E] AskLogin usecase', () => {
	let app: INestApplication;
	let utilRepository: UsersTestRepository;
	let postgresqlContainer: StartedPostgreSqlContainer;
	let redisContainer: StartedRedisContainer;
	let userTestSdk: UsersTestSdk;

	before(async () => {
		const testModule = await Test.createTestingModule({
			imports: [
				InfraModule,
				ConfigModule.forRoot({
					load: [dbConfig, jwtConfig, otpBotConfig, otpConfig, redisConfig],
					isGlobal: true,
					envFilePath: '.env.test',
				}),
				UserModule,
				TelegramModule.forRoot({
					useTelegramAPI: false,
				}),
			],
		}).compile();

		app = testModule.createNestApplication();

		const _dbConfig = app.get<ConfigType<typeof dbConfig>>(dbConfig.KEY);
		const _redisConfig = app.get<ConfigType<typeof redisConfig>>(redisConfig.KEY);

		const kysely = app.get(DatabaseProvider);

		postgresqlContainer = await new PostgreSqlContainer()
			.withHostname(_dbConfig.host)
			.withExposedPorts(_dbConfig.port)
			.withDatabase(_dbConfig.database)
			.withUsername(_dbConfig.user)
			.withPassword(_dbConfig.password)
			.start();

		redisContainer = await new RedisContainer()
			.withHostname(_redisConfig.redisHost)
			// 6379
			.withExposedPorts(_redisConfig.redisPort)
			.withUser(_redisConfig.redisUsername)
			.withPassword(_redisConfig.redisPassword || '')
			.start();

		utilRepository = new UsersTestRepository(kysely);

		await runMigrations({ useReal: true, connectionInfo: _dbConfig });

		userTestSdk = new UsersTestSdk(
			new TestHttpClient({
				port: 3000,
				host: '127.0.0.1',
			}),
		);

		await app.init();
		await app.listen(3000);
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
				email: 'chelik@sosnja.com',
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

		expect(res.status).to.equal(200);
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
				email: 'chelik@sosnja.com',
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
				isAuth: false,
			},
		});

		expect(res.status).to.equal(200);
		expect(res.body).to.deep.equal({});
	});
});
