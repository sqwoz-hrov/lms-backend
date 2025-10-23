import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { expect } from 'chai';
import { randomWord } from '../../../../test/fixtures/common.fixture';
import { createEmail, createName } from '../../../../test/fixtures/user.fixture';
import { TestHttpClient } from '../../../../test/test.http-client';
import { ISharedContext } from '../../../../test/setup/test.app-setup';
import { jwtConfig } from '../../../config';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { UsersTestRepository } from '../../test-utils/test.repo';
import { UsersTestSdk } from '../../test-utils/test.sdk';
import { OTPRedisStorage } from '../../adapters/otp-storage.adapter';

describe('[E2E] Send signup OTP usecase', () => {
	let app: INestApplication;

	let utilRepository: UsersTestRepository;
	let userTestSdk: UsersTestSdk;
	let otpStorage: OTPRedisStorage;

	before(function (this: ISharedContext) {
		app = this.app;
		const kysely = app.get(DatabaseProvider);
		utilRepository = new UsersTestRepository(kysely);
		otpStorage = app.get(OTPRedisStorage);

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

	it('Creates OTP for a newly signed up user without telegram ID', async () => {
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
		expect(sendOtpRes.body.status).to.equal('pending_contact');

		const otp = await otpStorage.getOtp(signupRes.body.id);
		expect(otp).to.not.equal(undefined);
	});

	it('Sends OTP through Telegram when telegram ID is present', async () => {
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

		await utilRepository.connection
			.updateTable('user')
			.set({ telegram_id: 123456 })
			.where('id', '=', signupRes.body.id)
			.execute();

		const sendOtpRes = await userTestSdk.sendSignupOtp({
			params: { email: signupPayload.email },
			userMeta: {
				isAuth: false,
			},
		});

		expect(sendOtpRes.status).to.equal(HttpStatus.ACCEPTED);
		if (sendOtpRes.status !== HttpStatus.ACCEPTED) throw new Error();
		expect(sendOtpRes.body.status).to.equal('otp_sent');
	});

	it('Returns 404 when user is not found', async () => {
		const sendOtpRes = await userTestSdk.sendSignupOtp({
			params: { email: createEmail() },
			userMeta: {
				isAuth: false,
			},
		});

		expect(sendOtpRes.status).to.equal(HttpStatus.NOT_FOUND);
	});
});
