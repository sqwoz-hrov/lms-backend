import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { expect } from 'chai';
import Redis from 'ioredis';
import { randomWord } from '../../../../test/fixtures/common.fixture';
import { createEmail, createName } from '../../../../test/fixtures/user.fixture';
import { ISharedContext } from '../../../../test/setup/test.app-setup';
import { TestHttpClient } from '../../../../test/test.http-client';
import { jwtConfig } from '../../../config';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { REDIS_CONNECTION_KEY } from '../../../infra/redis.const';
import { OTPRedisStorage } from '../../adapters/otp-storage.adapter';
import { UsersTestRepository } from '../../test-utils/test.repo';
import { UsersTestSdk } from '../../test-utils/test.sdk';

describe('[E2E] Finish registration usecase', () => {
	let app: INestApplication;

	let utilRepository: UsersTestRepository;
	let userTestSdk: UsersTestSdk;
	let otpStorage: OTPRedisStorage;
	let redisConnection: Redis;
	let freeTierId: string;

	before(function (this: ISharedContext) {
		app = this.app;
		const kysely = app.get(DatabaseProvider);
		utilRepository = new UsersTestRepository(kysely);
		otpStorage = app.get(OTPRedisStorage);
		redisConnection = app.get(REDIS_CONNECTION_KEY);

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

	beforeEach(async () => {
		const tier = await utilRepository.connection
			.insertInto('subscription_tier')
			.values({
				tier: `free-${randomWord()}`,
				permissions: [],
				power: 0,
			})
			.returningAll()
			.executeTakeFirstOrThrow();

		freeTierId = tier.id;
	});

	afterEach(async () => {
		await utilRepository.clearAll();
		await redisConnection.flushall();
	});

	it('Finishes registration with correct OTP', async () => {
		const signupPayload = {
			name: createName(),
			email: createEmail(),
			telegram_username: randomWord(),
		};

		const signupRes = await userTestSdk.publicSignUp({
			params: signupPayload,
			userMeta: {
				isAuth: false,
			},
		});

		expect(signupRes.status).to.equal(HttpStatus.CREATED);
		if (signupRes.status !== HttpStatus.CREATED) throw new Error();

		const sendOtpRes = await userTestSdk.sendSignupOtp({
			params: { email: signupPayload.email },
			userMeta: {
				isAuth: false,
			},
		});

		expect(sendOtpRes.status).to.equal(HttpStatus.ACCEPTED);
		if (sendOtpRes.status !== HttpStatus.ACCEPTED) throw new Error();

		const otp = await otpStorage.getOtp(signupRes.body.id);
		if (!otp) {
			throw new Error('OTP not found');
		}

		await utilRepository.connection.updateTable('user').set('telegram_id', 100000).execute();

		const finishRes = await userTestSdk.finishRegistration({
			params: {
				email: signupPayload.email,
				otpCode: Number(otp.asString),
			},
			userMeta: {
				isAuth: false,
			},
		});

		expect(finishRes.status).to.equal(HttpStatus.ACCEPTED);
		if (finishRes.status !== HttpStatus.ACCEPTED) throw new Error();
		expect(finishRes.body).to.deep.equal({ ok: true });

		const user = await utilRepository.connection
			.selectFrom('user')
			.selectAll()
			.where('id', '=', signupRes.body.id)
			.limit(1)
			.executeTakeFirstOrThrow();

		expect(user.finished_registration).to.equal(true);

		const subscription = await utilRepository.connection
			.selectFrom('subscription')
			.selectAll()
			.where('user_id', '=', signupRes.body.id)
			.limit(1)
			.executeTakeFirst();

		expect(subscription?.subscription_tier_id).to.equal(freeTierId);
		expect(subscription?.is_gifted).to.equal(true);
		expect(subscription?.price_on_purchase_rubles).to.equal(0);
		expect(subscription?.status).to.equal('active');
		expect(subscription?.current_period_end).to.equal(null);
		expect(subscription?.next_billing_at).to.equal(null);
	});

	it('Fails with wrong OTP', async () => {
		const signupPayload = {
			name: createName(),
			email: createEmail(),
			telegram_username: randomWord(),
		};

		const signupRes = await userTestSdk.publicSignUp({
			params: signupPayload,
			userMeta: {
				isAuth: false,
			},
		});

		expect(signupRes.status).to.equal(HttpStatus.CREATED);
		if (signupRes.status !== HttpStatus.CREATED) throw new Error();

		const sendOtpRes = await userTestSdk.sendSignupOtp({
			params: { email: signupPayload.email },
			userMeta: {
				isAuth: false,
			},
		});

		expect(sendOtpRes.status).to.equal(HttpStatus.ACCEPTED);
		if (sendOtpRes.status !== HttpStatus.ACCEPTED) throw new Error();

		const finishRes = await userTestSdk.finishRegistration({
			params: {
				email: signupPayload.email,
				otpCode: 111111,
			},
			userMeta: {
				isAuth: false,
			},
		});

		expect(finishRes.status).to.equal(HttpStatus.UNPROCESSABLE_ENTITY);
	});
});
