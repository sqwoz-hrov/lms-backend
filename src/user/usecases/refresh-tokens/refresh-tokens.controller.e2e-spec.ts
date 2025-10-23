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
import { JwtService } from '../../../infra/services/jwt.service';

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

describe('[E2E] Refresh tokens endpoint', () => {
	let app: INestApplication;
	let utilRepository: UsersTestRepository;
	let userTestSdk: UsersTestSdk;
	let redis: Redis;
	let jwt: JwtService;
	let cfg: ConfigType<typeof jwtConfig>;
	const ACCESS_COOKIE = 'access_token';
	const REFRESH_COOKIE = 'refresh_token';

	before(function (this: ISharedContext) {
		app = this.app;

		const kysely = app.get(DatabaseProvider);
		utilRepository = new UsersTestRepository(kysely);
		redis = app.get<Redis>(REDIS_CONNECTION_KEY);
		jwt = app.get(JwtService);
		cfg = app.get<ConfigType<typeof jwtConfig>>(jwtConfig.KEY);

		userTestSdk = new UsersTestSdk(new TestHttpClient({ port: 3000, host: 'http://127.0.0.1' }, cfg));
	});

	afterEach(async () => {
		await utilRepository.clearAll();
	});

	it('Valid refresh rotates tokens and sets new cookies', async () => {
		const user = await createTestUser(utilRepository);

		const ask = await userTestSdk.askLogin({
			params: { email: user.email },
			userMeta: { isAuth: false },
		});
		expect(ask.status).to.equal(202);

		const otpCode = await redis.get(user.id);

		const finish = await userTestSdk.finishLogin({
			params: { email: user.email, otpCode: Number(otpCode) },
			userMeta: { isAuth: false },
		});
		expect(finish.status).to.equal(202);

		const map1 = cookieMap(finish.cookies);
		const r1 = map1.get(REFRESH_COOKIE)!;
		expect(r1).to.be.a('string');

		const refreshRes = await userTestSdk.refresh({
			params: { fallbackToken: r1 },
			userMeta: { isAuth: false },
		});

		expect(refreshRes.status).to.equal(200);
		const map2 = cookieMap(refreshRes.cookies);
		expect(map2.has(ACCESS_COOKIE)).to.equal(true);
		expect(map2.has(REFRESH_COOKIE)).to.equal(true);

		const r2 = map2.get(REFRESH_COOKIE)!;
		expect(r2).to.be.a('string');
		expect(r2).to.not.equal(r1);
	});

	it('Reusing old refresh after rotation is rejected (401)', async () => {
		const user = await createTestUser(utilRepository);

		const ask = await userTestSdk.askLogin({
			params: { email: user.email },
			userMeta: { isAuth: false },
		});
		expect(ask.status).to.equal(202);

		const otpCode = await redis.get(user.id);

		const finish = await userTestSdk.finishLogin({
			params: { email: user.email, otpCode: Number(otpCode) },
			userMeta: { isAuth: false },
		});
		expect(finish.status).to.equal(202);

		const map1 = cookieMap(finish.cookies);
		const oldRefresh = map1.get(REFRESH_COOKIE)!;

		const first = await userTestSdk.refresh({
			params: { fallbackToken: oldRefresh },
			userMeta: { isAuth: false },
		});
		expect(first.status).to.equal(200);

		const reuse = await userTestSdk.refresh({
			params: { fallbackToken: oldRefresh },
			userMeta: { isAuth: false },
		});
		expect(reuse.status).to.equal(401);
	});

	it('No token provided → 401', async () => {
		const res = await userTestSdk.refresh({
			params: { fallbackToken: '' },
			userMeta: { isAuth: false },
		});
		expect(res.status).to.equal(401);
		const cookies = res.cookies ?? [];
		expect(cookies.length).to.equal(0);
	});

	it('Token not found in Redis → 401', async () => {
		const user = await createTestUser(utilRepository);

		const ask = await userTestSdk.askLogin({
			params: { email: user.email },
			userMeta: { isAuth: false },
		});
		expect(ask.status).to.equal(202);

		const otpCode = await redis.get(user.id);

		const finish = await userTestSdk.finishLogin({
			params: { email: user.email, otpCode: Number(otpCode) },
			userMeta: { isAuth: false },
		});
		expect(finish.status).to.equal(202);

		const map = cookieMap(finish.cookies);
		const refreshToken = map.get(REFRESH_COOKIE)!;

		const payload = jwt.decode(refreshToken)!;
		expect(payload.type).to.equal('refresh');
		expect(payload.jti).to.be.a('string');

		await redis.del(`rt:${payload.jti}`);

		const res = await userTestSdk.refresh({
			params: { fallbackToken: refreshToken },
			userMeta: { isAuth: false },
		});
		expect(res.status).to.equal(401);
	});

	it('Tampered token (bad signature) → 401', async () => {
		const user = await createTestUser(utilRepository);

		const ask = await userTestSdk.askLogin({
			params: { email: user.email },
			userMeta: { isAuth: false },
		});
		expect(ask.status).to.equal(202);

		const otpCode = await redis.get(user.id);

		const finish = await userTestSdk.finishLogin({
			params: { email: user.email, otpCode: Number(otpCode) },
			userMeta: { isAuth: false },
		});
		expect(finish.status).to.equal(202);

		const map = cookieMap(finish.cookies);
		const refreshToken = map.get(REFRESH_COOKIE)!;

		const tampered = refreshToken + 'a';

		const res = await userTestSdk.refresh({
			params: { fallbackToken: tampered },
			userMeta: { isAuth: false },
		});
		expect(res.status).to.equal(401);
	});
});
