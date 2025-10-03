import { INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { expect } from 'chai';
import Redis from 'ioredis';
import { createTestUser } from '../../../../test/fixtures/user.fixture';
import { TestHttpClient } from '../../../../test/test.http-client';
import { ISharedContext } from '../../../../test/setup/test.app-setup';
import { jwtConfig } from '../../../config';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { REDIS_CONNECTION_KEY } from '../../../infra/redis.const';
import { UsersTestRepository } from '../../test-utils/test.repo';
import { UsersTestSdk } from '../../test-utils/test.sdk';

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

describe('[E2E] Logout usecase', () => {
	let app: INestApplication;
	let utilRepository: UsersTestRepository;
	let userTestSdk: UsersTestSdk;
	let redisConnection: Redis;
	let jwtCfg: ConfigType<typeof jwtConfig>;

	before(function (this: ISharedContext) {
		app = this.app;

		const kysely = app.get(DatabaseProvider);
		utilRepository = new UsersTestRepository(kysely);
		redisConnection = app.get<Redis>(REDIS_CONNECTION_KEY);

		jwtCfg = app.get<ConfigType<typeof jwtConfig>>(jwtConfig.KEY);

		userTestSdk = new UsersTestSdk(
			new TestHttpClient(
				{
					port: 3000,
					host: 'http://127.0.0.1',
				},
				jwtCfg,
			),
		);
	});

	afterEach(async () => {
		await utilRepository.clearAll();
		await redisConnection.flushall();
	});

	it('Logout (current session): clears cookies and revokes the used refresh (subsequent refresh fails)', async () => {
		const user = await createTestUser(utilRepository);

		const askLoginResponse = await userTestSdk.askLogin({
			params: { email: user.email },
			userMeta: { isWrongAccessJwt: false, userId: user.id, isAuth: false },
		});
		expect(askLoginResponse.status).to.equal(202);

		const otpCode = Number(await redisConnection.get(user.id));

		const finishLoginResponse = await userTestSdk.finishLogin({
			params: { email: user.email, otpCode },
			userMeta: { isWrongAccessJwt: false, userId: user.id, isAuth: false },
		});
		expect(finishLoginResponse.status).to.equal(202);

		const cookiesAfterLogin = finishLoginResponse.cookies ?? [];
		const mapLogin = cookieMap(cookiesAfterLogin);
		const refreshToken = mapLogin.get('refresh_token');
		expect(refreshToken).to.be.a('string');

		if (!refreshToken) throw new Error('Refresh token is not defined');

		const refreshOk = await userTestSdk.refresh({
			params: { fallbackToken: refreshToken },
			userMeta: { isWrongAccessJwt: false, userId: user.id, isAuth: false },
		});
		expect(refreshOk.status).to.equal(200);

		const logoutResp = await userTestSdk.logout({
			params: { all: false, fallbackRefreshToken: refreshToken },
			userMeta: { isWrongAccessJwt: false, userId: user.id, isAuth: false },
		});
		expect(logoutResp.status).to.equal(200);

		const mapLogout = cookieMap(logoutResp.cookies ?? []);
		expect(mapLogout.get('access_token')).to.equal('');
		expect(mapLogout.get('refresh_token')).to.equal('');

		const refreshFail = await userTestSdk.refresh({
			params: { fallbackToken: refreshToken },
			userMeta: { isWrongAccessJwt: false, userId: user.id, isAuth: false },
		});
		expect(refreshFail.status).to.equal(401);
	});

	it('Logout all sessions: revokes every session; any old refresh can no longer refresh', async () => {
		const user = await createTestUser(utilRepository);

		const ask1 = await userTestSdk.askLogin({
			params: { email: user.email },
			userMeta: { isWrongAccessJwt: false, userId: user.id, isAuth: false },
		});
		expect(ask1.status).to.equal(202);
		const otp1 = Number(await redisConnection.get(user.id));
		const login1 = await userTestSdk.finishLogin({
			params: { email: user.email, otpCode: otp1 },
			userMeta: { isWrongAccessJwt: false, userId: user.id, isAuth: false },
		});
		expect(login1.status).to.equal(202);
		const r1 = cookieMap(login1.cookies ?? []).get('refresh_token')!;

		const ask2 = await userTestSdk.askLogin({
			params: { email: user.email },
			userMeta: { isWrongAccessJwt: false, userId: user.id, isAuth: false },
		});
		expect(ask2.status).to.equal(202);
		const otp2 = Number(await redisConnection.get(user.id));
		const login2 = await userTestSdk.finishLogin({
			params: { email: user.email, otpCode: otp2 },
			userMeta: { isWrongAccessJwt: false, userId: user.id, isAuth: false },
		});
		expect(login2.status).to.equal(202);
		const r2 = cookieMap(login2.cookies ?? []).get('refresh_token')!;

		const refresh1 = await userTestSdk.refresh({
			params: { fallbackToken: r1 },
			userMeta: { isWrongAccessJwt: false, userId: user.id, isAuth: false },
		});
		expect(refresh1.status).to.equal(200);

		const refresh2 = await userTestSdk.refresh({
			params: { fallbackToken: r2 },
			userMeta: { isWrongAccessJwt: false, userId: user.id, isAuth: false },
		});
		expect(refresh2.status).to.equal(200);

		const logoutAll = await userTestSdk.logout({
			params: { all: true, fallbackRefreshToken: r1 },
			userMeta: { isWrongAccessJwt: false, userId: user.id, isAuth: false },
		});
		expect(logoutAll.status).to.equal(200);

		const refresh1After = await userTestSdk.refresh({
			params: { fallbackToken: r1 },
			userMeta: { isWrongAccessJwt: false, userId: user.id, isAuth: false },
		});
		expect(refresh1After.status).to.equal(401);

		const refresh2After = await userTestSdk.refresh({
			params: { fallbackToken: r2 },
			userMeta: { isWrongAccessJwt: false, userId: user.id, isAuth: false },
		});
		expect(refresh2After.status).to.equal(401);
	});

	it('Logout without any tokens returns 401', async () => {
		const logoutResp = await userTestSdk.logout({
			params: {},
			userMeta: { isWrongAccessJwt: false, userId: 'no-user', isAuth: false },
		});
		expect(logoutResp.status).to.equal(401);
		expect((logoutResp.cookies ?? []).length).to.equal(0);
	});

	it('Logout with malformed refresh in body returns 401', async () => {
		const logoutResp = await userTestSdk.logout({
			params: { all: false, fallbackRefreshToken: 'not-a-jwt' },
			userMeta: { isWrongAccessJwt: false, userId: 'no-user', isAuth: false },
		});
		expect(logoutResp.status).to.equal(401);
		expect((logoutResp.cookies ?? []).length).to.equal(0);
	});
});
