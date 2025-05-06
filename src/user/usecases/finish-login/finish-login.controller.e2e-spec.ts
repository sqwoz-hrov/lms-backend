import { INestApplication } from '@nestjs/common';
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
import Redis from 'ioredis';
import { REDIS_CONNECTION_KEY } from '../../../infra/redis.const';
import { createTestUser } from '../../../../test/fixtures/user.fixture';

describe('[E2E] FinishLogin usecase', () => {
	let app: INestApplication;
	let utilRepository: UsersTestRepository;
	let userTestSdk: UsersTestSdk;
	let redisConnection: Redis;
	let shutdown: () => Promise<void>;

	before(async () => {
		({ app, shutdown } = await setupTestApplication({
			imports: [UserModule, TelegramModule.forRoot({ useTelegramAPI: false })],
		}));
		const kysely = app.get(DatabaseProvider);
		utilRepository = new UsersTestRepository(kysely);
		redisConnection = app.get<Redis>(REDIS_CONNECTION_KEY);

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
		await shutdown();
	});

	it('No JWT token works just fine', async () => {
		const user = await createTestUser(utilRepository);
		const askLoginResponse = await userTestSdk.askLogin({
			params: {
				email: user.email,
			},
			userMeta: {
				isWrongJwt: false,
				userId: user.id,
				isAuth: false,
			},
		});

		expect(askLoginResponse.status).to.equal(202);

		const otpCode = await redisConnection.get(user.id);
		const finishLoginResponse = await userTestSdk.finishLogin({
			params: {
				email: user.email,
				otpCode: Number(otpCode),
			},
			userMeta: {
				isWrongJwt: false,
				userId: user.id,
				isAuth: false,
			},
		});
		expect(finishLoginResponse.status).to.equal(202);
		expect(finishLoginResponse.body).to.have.property('token');
	});

	it('Authed user just renews token', async () => {
		const user = await createTestUser(utilRepository);
		const askLoginResponse = await userTestSdk.askLogin({
			params: {
				email: user.email,
			},
			userMeta: {
				isWrongJwt: false,
				userId: user.id,
				isAuth: true,
			},
		});

		expect(askLoginResponse.status).to.equal(202);

		const otpCode = await redisConnection.get(user.id);
		const finishLoginResponse = await userTestSdk.finishLogin({
			params: {
				email: user.email,
				otpCode: Number(otpCode),
			},
			userMeta: {
				isWrongJwt: false,
				userId: user.id,
				isAuth: true,
			},
		});
		expect(finishLoginResponse.status).to.equal(202);
		expect(finishLoginResponse.body).to.have.property('token');
	});

	it('Wrong OTP code returns 400', async () => {
		const user = await createTestUser(utilRepository);
		const askLoginResponse = await userTestSdk.askLogin({
			params: {
				email: user.email,
			},
			userMeta: {
				isWrongJwt: false,
				userId: user.id,
				isAuth: false,
			},
		});

		expect(askLoginResponse.status).to.equal(202);
		let otpCode = Number(await redisConnection.get(user.id));

		// Make sure the OTP code is wrong, but valid
		if (otpCode === 999999) otpCode -= 1;
		else otpCode += 1;

		const finishLoginResponse = await userTestSdk.finishLogin({
			params: {
				email: user.email,
				otpCode: otpCode,
			},
			userMeta: {
				isWrongJwt: false,
				userId: user.id,
				isAuth: false,
			},
		});
		expect(finishLoginResponse.status).to.equal(404);
	});
});
