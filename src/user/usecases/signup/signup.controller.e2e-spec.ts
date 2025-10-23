import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { expect } from 'chai';
import { randomWord } from '../../../../test/fixtures/common.fixture';
import { createEmail, createName, createTestUser } from '../../../../test/fixtures/user.fixture';
import { TestHttpClient } from '../../../../test/test.http-client';
import { ISharedContext } from '../../../../test/setup/test.app-setup';
import { jwtConfig } from '../../../config';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { UsersTestRepository } from '../../test-utils/test.repo';
import { UsersTestSdk } from '../../test-utils/test.sdk';
import { PublicSignupDto } from '../../dto/user.dto';

describe('[E2E] Public signup usecase', () => {
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

	it('Creates subscriber without authentication', async () => {
		const signupPayload = {
			name: createName(),
			email: createEmail(),
			telegram_username: randomWord(),
		};

		const res = await userTestSdk.publicSignUp({
			params: signupPayload,
			userMeta: {
				isAuth: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.CREATED);
		if (res.status != 201) throw new Error();
		expect(res.body.email).to.equal(signupPayload.email);
		expect(res.body.role).to.equal('subscriber');
		expect(res.body.telegram_username).to.equal(signupPayload.telegram_username);
		expect(res.body.name).to.equal(signupPayload.name);
		expect(res.body.id).to.be.a('string');
		expect(res.body.is_billable).to.equal(false);
		expect(res.body.active_until).to.equal(null);
		expect(res.body.subscription_tier_id).to.equal(null);
		expect(res.body.subscription_tier).to.equal(null);
		expect(res.body.is_archived).to.equal(false);
		expect(res.body.finished_registration).to.equal(false);
	});

	it('Returns 400 when telegram username is missing', async () => {
		const res = await userTestSdk.publicSignUp({
			params: {
				name: createName(),
				email: createEmail(),
			} as PublicSignupDto,
			userMeta: {
				isAuth: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.BAD_REQUEST);
		if (res.status !== HttpStatus.BAD_REQUEST) throw new Error();
		expect(res.body.description).to.contain('telegram_username');
	});

	it('Returns 400 when email has invalid format', async () => {
		const res = await userTestSdk.publicSignUp({
			params: {
				name: createName(),
				email: 'definitely-not-an-email',
				telegram_username: randomWord(),
			} as PublicSignupDto,
			userMeta: {
				isAuth: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.BAD_REQUEST);
		if (res.status !== HttpStatus.BAD_REQUEST) throw new Error();
		expect(res.body.description).to.contain('email must be an email');
	});

	it('Prevents privilege escalation attempts during signup', async () => {
		const signupPayload = {
			name: createName(),
			email: createEmail(),
			telegram_username: randomWord(),
			role: 'admin',
			is_billable: true,
			finished_registration: true,
		};

		const res = await userTestSdk.publicSignUp({
			params: signupPayload as PublicSignupDto,
			userMeta: {
				isAuth: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.CREATED);
		if (res.status !== HttpStatus.CREATED) throw new Error();
		expect(res.body.email).to.equal(signupPayload.email);
		expect(res.body.role).to.equal('subscriber');
		expect(res.body.is_billable).to.equal(false);
		expect(res.body.finished_registration).to.equal(false);
		expect(res.body.subscription_tier_id).to.equal(null);

		const user = await utilRepository.connection
			.selectFrom('user')
			.select(['role', 'is_billable', 'finished_registration', 'subscription_tier_id'])
			.where('id', '=', res.body.id)
			.limit(1)
			.executeTakeFirstOrThrow();

		expect(user.role).to.equal('subscriber');
		expect(user.is_billable).to.equal(false);
		expect(user.finished_registration).to.equal(false);
		expect(user.subscription_tier_id).to.equal(null);
	});

	it('Prevents privilege escalation attempts during signup even if user is authorized', async () => {
		const signupPayload = {
			name: createName(),
			email: createEmail(),
			telegram_username: randomWord(),
			role: 'admin',
			is_billable: true,
			finished_registration: true,
		};

		const requestAuthor = await createTestUser(utilRepository);

		const res = await userTestSdk.publicSignUp({
			params: signupPayload as PublicSignupDto,
			userMeta: {
				userId: requestAuthor.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.CREATED);
		if (res.status !== HttpStatus.CREATED) throw new Error();
		expect(res.body.email).to.equal(signupPayload.email);
		expect(res.body.role).to.equal('subscriber');
		expect(res.body.is_billable).to.equal(false);
		expect(res.body.finished_registration).to.equal(false);
		expect(res.body.subscription_tier_id).to.equal(null);

		const user = await utilRepository.connection
			.selectFrom('user')
			.select(['role', 'finished_registration'])
			.where('id', '=', res.body.id)
			.limit(1)
			.executeTakeFirstOrThrow();

		expect(user.role).to.equal('subscriber');
		expect(user.finished_registration).to.equal(false);
	});

	it('Returns 400 when trying to sign up with duplicate email', async () => {
		const duplicateEmail = createEmail();
		await createTestUser(utilRepository, {
			email: duplicateEmail,
		});

		const res = await userTestSdk.publicSignUp({
			params: {
				name: createName(),
				email: duplicateEmail,
				telegram_username: randomWord(),
			},
			userMeta: {
				isAuth: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.BAD_REQUEST);
		if (res.status != 400) throw new Error();
		expect(res.body.description).to.equal('Пользователь с таким email уже существует');
	});
});
