import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { StartedRedisContainer } from '@testcontainers/redis';
import { setupTestApplication } from '../../../../test/test.app-setup';
import { TestHttpClient } from '../../../../test/test.http-client';
import { jwtConfig } from '../../../config';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { HrConnectionModule } from '../../hr-connection.module';
import { HrConnectionsTestRepository } from '../../test-utils/test.repo';
import { UsersTestRepository } from '../../../user/test-utils/test.repo';
import { UserModule } from '../../../user/user.module';
import { HrConnectionsTestSdk } from '../../test-utils/test.sdk';
import { expect } from 'chai';
import { createTestAdmin, createTestUser } from '../../../../test/fixtures/user.fixture';
import { createTestHrConnection } from '../../../../test/fixtures/hr-connection.fixture';
import { TelegramModule } from '../../../telegram/telegram.module';
import { v7 } from 'uuid';

describe('[E2E] Delete HR connection usecase', () => {
	let app: INestApplication;
	let postgresqlContainer: StartedPostgreSqlContainer;
	let redisContainer: StartedRedisContainer;

	let userUtilRepository: UsersTestRepository;
	let hrUtilRepository: HrConnectionsTestRepository;
	let hrTestSdk: HrConnectionsTestSdk;

	before(async () => {
		({ app, postgresqlContainer, redisContainer } = await setupTestApplication({
			imports: [HrConnectionModule, UserModule, TelegramModule.forRoot({ useTelegramAPI: false })],
		}));

		const kysely = app.get(DatabaseProvider);
		userUtilRepository = new UsersTestRepository(kysely);
		hrUtilRepository = new HrConnectionsTestRepository(kysely);

		await app.init();
		await app.listen(3000);

		hrTestSdk = new HrConnectionsTestSdk(
			new TestHttpClient({
				port: 3000,
				host: 'http://127.0.0.1',
			}),
			app.get<ConfigType<typeof jwtConfig>>(jwtConfig.KEY),
		);
	});

	afterEach(async () => {
		await hrUtilRepository.clearAll();
		await userUtilRepository.clearAll();
	});

	after(async () => {
		await app.close();
		await postgresqlContainer.stop();
		await redisContainer.stop();
	});

	it('Unauthenticated request gets 401', async () => {
		const user = await createTestUser(userUtilRepository);
		const hrConnection = await createTestHrConnection(userUtilRepository, hrUtilRepository);

		const res = await hrTestSdk.deleteHrConnection({
			params: { id: hrConnection.id },
			userMeta: {
				userId: user.id,
				isAuth: false,
				isWrongJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Fake JWT gets 401', async () => {
		const user = await createTestUser(userUtilRepository);
		const hrConnection = await createTestHrConnection(userUtilRepository, hrUtilRepository);

		const res = await hrTestSdk.deleteHrConnection({
			params: { id: hrConnection.id },
			userMeta: {
				userId: user.id,
				isAuth: true,
				isWrongJwt: true,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('User can delete their HR connection', async () => {
		const user = await createTestUser(userUtilRepository);
		const hrConnection = await createTestHrConnection(userUtilRepository, hrUtilRepository, {
			hrConnection: { student_user_id: user.id },
		});

		const res = await hrTestSdk.deleteHrConnection({
			params: { id: hrConnection.id },
			userMeta: {
				userId: user.id,
				isAuth: true,
				isWrongJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.OK);
	});

	it(`User can not delete another user's HR connection`, async () => {
		const owner = await createTestUser(userUtilRepository);
		const anotherUser = await createTestUser(userUtilRepository);
		const hrConnection = await createTestHrConnection(userUtilRepository, hrUtilRepository, {
			hrConnection: { student_user_id: owner.id },
		});

		const res = await hrTestSdk.deleteHrConnection({
			params: { id: hrConnection.id },
			userMeta: {
				userId: anotherUser.id,
				isAuth: true,
				isWrongJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Admin can delete any HR connection', async () => {
		const admin = await createTestAdmin(userUtilRepository);
		const student = await createTestUser(userUtilRepository);
		const hrConnection = await createTestHrConnection(userUtilRepository, hrUtilRepository, {
			hrConnection: { student_user_id: student.id },
		});

		const res = await hrTestSdk.deleteHrConnection({
			params: { id: hrConnection.id },
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.OK);
	});

	it('Non-existent HR connection returns 404', async () => {
		const user = await createTestUser(userUtilRepository);

		const res = await hrTestSdk.deleteHrConnection({
			params: { id: v7() },
			userMeta: {
				userId: user.id,
				isAuth: true,
				isWrongJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.NOT_FOUND);
	});
});
