import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { StartedRedisContainer } from '@testcontainers/redis';
import { setupTestApplication } from '../../../../test/test.app-setup';
import { TestHttpClient } from '../../../../test/test.http-client';
import { jwtConfig } from '../../../config';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { UserModule } from '../../../user/user.module';
import { TelegramModule } from '../../../telegram/telegram.module';
import { HrConnectionModule } from '../../hr-connection.module';
import { expect } from 'chai';
import { createTestAdmin, createTestUser } from '../../../../test/fixtures/user.fixture';
import { UsersTestRepository } from '../../../user/test-utils/test.repo';
import { HrConnectionsTestRepository } from '../../test-utils/test.repo';
import { HrConnectionsTestSdk } from '../../test-utils/test.sdk';
import { createTestHrConnection } from '../../../../test/fixtures/hr-connection.fixture';
import { UpdateHrConnectionDto } from '../../dto/update-hr-connection.dto';
import { randomWord } from '../../../../test/fixtures/common.fixture';

describe('[E2E] Edit HR Connection', () => {
	let app: INestApplication;
	let postgresqlContainer: StartedPostgreSqlContainer;
	let redisContainer: StartedRedisContainer;

	let userUtilRepository: UsersTestRepository;
	let hrUtilRepository: HrConnectionsTestRepository;
	let hrSdk: HrConnectionsTestSdk;

	before(async () => {
		({ app, postgresqlContainer, redisContainer } = await setupTestApplication({
			imports: [HrConnectionModule, UserModule, TelegramModule.forRoot({ useTelegramAPI: false })],
		}));

		const kysely = app.get(DatabaseProvider);
		userUtilRepository = new UsersTestRepository(kysely);
		hrUtilRepository = new HrConnectionsTestRepository(kysely);

		await app.init();
		await app.listen(3000);

		hrSdk = new HrConnectionsTestSdk(
			new TestHttpClient({ port: 3000, host: 'http://127.0.0.1' }),
			app.get<ConfigType<typeof jwtConfig>>(jwtConfig.KEY),
		);
	});

	afterEach(async () => {
		await userUtilRepository.clearAll();
		await hrUtilRepository.clearAll();
	});

	after(async () => {
		await app.close();
		await postgresqlContainer.stop();
		await redisContainer.stop();
	});

	it('Unauthenticated user gets 401', async () => {
		const user = await createTestUser(userUtilRepository);
		const hrConnection = await createTestHrConnection(userUtilRepository, hrUtilRepository, {
			hrConnection: { student_user_id: user.id },
		});

		const dto: UpdateHrConnectionDto = {
			id: hrConnection.id,
			name: randomWord(),
		};

		const res = await hrSdk.editHrConnection({
			params: dto,
			userMeta: {
				userId: user.id,
				isAuth: false,
				isWrongJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('User with fake JWT gets 401', async () => {
		const user = await createTestUser(userUtilRepository);
		const hrConnection = await createTestHrConnection(userUtilRepository, hrUtilRepository, {
			hrConnection: { student_user_id: user.id },
		});

		const dto: UpdateHrConnectionDto = {
			id: hrConnection.id,
			name: randomWord(),
		};

		const res = await hrSdk.editHrConnection({
			params: dto,
			userMeta: {
				userId: user.id,
				isAuth: false,
				isWrongJwt: true,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('User can edit their own HR connection', async () => {
		const user = await createTestUser(userUtilRepository);
		const hrConnection = await createTestHrConnection(userUtilRepository, hrUtilRepository, {
			hrConnection: { student_user_id: user.id },
		});

		const newCompany = randomWord();

		const dto: UpdateHrConnectionDto = {
			id: hrConnection.id,
			name: newCompany,
		};

		const res = await hrSdk.editHrConnection({
			params: dto,
			userMeta: {
				userId: user.id,
				isAuth: true,
				isWrongJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.OK);
		expect(res.body.name).to.equal(newCompany);
	});

	it('User cannot edit another user’s HR connection', async () => {
		const owner = await createTestUser(userUtilRepository);
		const anotherUser = await createTestUser(userUtilRepository);
		const hrConnection = await createTestHrConnection(userUtilRepository, hrUtilRepository, {
			hrConnection: { student_user_id: owner.id },
		});

		const dto: UpdateHrConnectionDto = {
			id: hrConnection.id,
			name: randomWord(),
		};

		const res = await hrSdk.editHrConnection({
			params: dto,
			userMeta: {
				userId: anotherUser.id,
				isAuth: true,
				isWrongJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Admin can edit any HR connection', async () => {
		const admin = await createTestAdmin(userUtilRepository);
		const user = await createTestUser(userUtilRepository);
		const hrConnection = await createTestHrConnection(userUtilRepository, hrUtilRepository, {
			hrConnection: { student_user_id: user.id },
		});

		const newCompany = randomWord();

		const dto: UpdateHrConnectionDto = {
			id: hrConnection.id,
			name: newCompany,
			student_user_id: user.id,
		};

		const res = await hrSdk.editHrConnection({
			params: dto,
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.OK);
		expect(res.body.name).to.equal(newCompany);
		expect(res.body.student_user_id).to.equal(user.id);
	});
});
