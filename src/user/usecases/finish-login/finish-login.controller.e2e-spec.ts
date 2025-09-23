import { INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { expect } from 'chai';
import Redis from 'ioredis';
import { createTestUser } from '../../../../test/fixtures/user.fixture';
import { TestHttpClient } from '../../../../test/test.http-client';
import { ISharedContext } from '../../../../test/test.app-setup';
import { jwtConfig } from '../../../config';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { REDIS_CONNECTION_KEY } from '../../../infra/redis.const';
import { UsersTestRepository } from '../../test-utils/test.repo';
import { UsersTestSdk } from '../../test-utils/test.sdk';

const ensureWrongOtpCode = (otpCode: number) => {
	// handle six digit overflow
	if (otpCode === 999999) otpCode -= 1;
	else otpCode += 1;
	return otpCode;
};

function cookieMap(setCookie: string[] | undefined) {
	const map = new Map<string, string>();
	(setCookie ?? []).forEach(header => {
		const first = header.split(';', 1)[0];
		const eqIdx = first.indexOf('=');
		if (eqIdx > 0) {
			const name = first.slice(0, eqIdx).trim();
			const value = first.slice(eqIdx + 1).trim();
			map.set(name, value);
		}
	});
	return map;
}

describe('[E2E] FinishLogin usecase', () => {
	let app: INestApplication;
	let utilRepository: UsersTestRepository;
	let userTestSdk: UsersTestSdk;
	let redisConnection: Redis;

	before(function (this: ISharedContext) {
		app = this.app;

		const kysely = app.get(DatabaseProvider);
		utilRepository = new UsersTestRepository(kysely);
		redisConnection = app.get<Redis>(REDIS_CONNECTION_KEY);

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

	it('No JWT token works just fine (sets cookies)', async () => {
		const user = await createTestUser(utilRepository);

		const askLoginResponse = await userTestSdk.askLogin({
			params: { email: user.email },
			userMeta: {
				isWrongAccessJwt: false,
				userId: user.id,
				isAuth: false,
			},
		});
		expect(askLoginResponse.status).to.equal(202);

		const otpCode = await redisConnection.get(user.id);

		const finishLoginResponse = await userTestSdk.finishLogin({
			params: { email: user.email, otpCode: Number(otpCode) },
			userMeta: {
				isWrongAccessJwt: false,
				userId: user.id,
				isAuth: false,
			},
		});

		expect(finishLoginResponse.status).to.equal(202);

		const cookies = finishLoginResponse.cookies ?? [];
		const map = cookieMap(cookies);

		expect(map.has('access_token')).to.equal(true, 'access_token must be set');
		expect(map.has('refresh_token')).to.equal(true, 'refresh_token must be set');
	});

	it('Authed user just renews token (sets cookies again)', async () => {
		const user = await createTestUser(utilRepository);

		const askLoginResponse = await userTestSdk.askLogin({
			params: { email: user.email },
			userMeta: {
				isWrongAccessJwt: false,
				userId: user.id,
				isAuth: true,
			},
		});
		expect(askLoginResponse.status).to.equal(202);

		const otpCode = await redisConnection.get(user.id);

		const finishLoginResponse = await userTestSdk.finishLogin({
			params: { email: user.email, otpCode: Number(otpCode) },
			userMeta: {
				isWrongAccessJwt: false,
				userId: user.id,
				isAuth: true,
			},
		});

		expect(finishLoginResponse.status).to.equal(202);

		const cookies = finishLoginResponse.cookies ?? [];
		const map = cookieMap(cookies);

		expect(map.has('access_token')).to.equal(true, 'access_token must be re-set');
		expect(map.has('refresh_token')).to.equal(true, 'refresh_token must be re-set');
	});

	it('Wrong OTP code returns 422 (no cookies)', async () => {
		const user = await createTestUser(utilRepository);

		const askLoginResponse = await userTestSdk.askLogin({
			params: { email: user.email },
			userMeta: {
				isWrongAccessJwt: false,
				userId: user.id,
				isAuth: false,
			},
		});
		expect(askLoginResponse.status).to.equal(202);

		let otpCode = Number(await redisConnection.get(user.id));
		otpCode = ensureWrongOtpCode(otpCode);

		const finishLoginResponse = await userTestSdk.finishLogin({
			params: { email: user.email, otpCode },
			userMeta: {
				isWrongAccessJwt: false,
				userId: user.id,
				isAuth: false,
			},
		});

		expect(finishLoginResponse.status).to.equal(422);

		const cookies = finishLoginResponse.cookies ?? [];
		expect(cookies.length).to.equal(0);
	});
});
