import { INestApplication, HttpStatus } from '@nestjs/common';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { StartedRedisContainer } from '@testcontainers/redis';
import { expect } from 'chai';
import { ConfigType } from '@nestjs/config';
import { setupTestApplication } from '../../../../test/test.app-setup';
import { createTestAdmin, createTestUser } from '../../../../test/fixtures/user.fixture';
import { createTestHrConnection } from '../../../../test/fixtures/hr-connection.fixture';
import { TestHttpClient } from '../../../../test/test.http-client';
import { jwtConfig } from '../../../config';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { UserModule } from '../../../user/user.module';
import { HrConnectionModule } from '../../hr-connection.module';
import { UsersTestRepository } from '../../../user/test-utils/test.repo';
import { HrConnectionsTestRepository } from '../../test-utils/test.repo';
import { HrConnectionsTestSdk } from '../../test-utils/test.sdk';
import { User } from '../../../user/user.entity';
import { TelegramModule } from '../../../telegram/telegram.module';

describe('[E2E] Get HR connections usecase', () => {
	let app: INestApplication;
	let postgresqlContainer: StartedPostgreSqlContainer;
	let redisContainer: StartedRedisContainer;

	let userUtilRepository: UsersTestRepository;
	let hrConnectionUtilRepository: HrConnectionsTestRepository;
	let sdk: HrConnectionsTestSdk;

	before(async () => {
		({ app, postgresqlContainer, redisContainer } = await setupTestApplication({
			imports: [HrConnectionModule, UserModule, TelegramModule.forRoot({ useTelegramAPI: false })],
		}));

		const kysely = app.get(DatabaseProvider);
		userUtilRepository = new UsersTestRepository(kysely);
		hrConnectionUtilRepository = new HrConnectionsTestRepository(kysely);

		await app.init();
		await app.listen(3000);

		sdk = new HrConnectionsTestSdk(
			new TestHttpClient({ port: 3000, host: 'http://127.0.0.1' }),
			app.get<ConfigType<typeof jwtConfig>>(jwtConfig.KEY),
		);
	});

	afterEach(async () => {
		await userUtilRepository.clearAll();
		await hrConnectionUtilRepository.clearAll();
	});

	after(async () => {
		await app.close();
		await postgresqlContainer.stop();
		await redisContainer.stop();
	});

	it('Unauthenticated gets 401', async () => {
		const user = await createTestUser(userUtilRepository);
		const res = await sdk.getHrConnections({
			params: {},
			userMeta: { userId: user.id, isAuth: false, isWrongJwt: false },
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Fake JWT gets 401', async () => {
		const user = await createTestUser(userUtilRepository);
		const res = await sdk.getHrConnections({
			params: {},
			userMeta: { userId: user.id, isAuth: true, isWrongJwt: true },
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	describe('Query filters and access control', () => {
		let admin1: User;
		let admin2: User;

		let user1: User;
		let user2: User;
		let user3: User;

		beforeEach(async () => {
			admin1 = await createTestAdmin(userUtilRepository);
			admin2 = await createTestAdmin(userUtilRepository);

			user1 = await createTestUser(userUtilRepository);
			user2 = await createTestUser(userUtilRepository);
			user3 = await createTestUser(userUtilRepository);

			// HR connections
			await createTestHrConnection(userUtilRepository, hrConnectionUtilRepository, {
				hrConnection: { student_user_id: user1.id },
			});
			await createTestHrConnection(userUtilRepository, hrConnectionUtilRepository, {
				hrConnection: { student_user_id: user2.id },
			});
			await createTestHrConnection(userUtilRepository, hrConnectionUtilRepository, {
				hrConnection: { student_user_id: user2.id },
			});
			await createTestHrConnection(userUtilRepository, hrConnectionUtilRepository, {
				hrConnection: { student_user_id: user3.id },
			});
		});

		it('Admin can filter by student_user_id', async () => {
			const res = await sdk.getHrConnections({
				params: { student_user_id: user2.id },
				userMeta: { userId: admin1.id, isAuth: true, isWrongJwt: false },
			});

			expect(res.status).to.equal(HttpStatus.OK);
			expect(res.body).to.be.an('array').with.length(2);
			for (const conn of res.body) {
				expect(conn.student_user_id).to.equal(user2.id);
			}
		});

		it('Admin without filters gets all connections', async () => {
			const res = await sdk.getHrConnections({
				params: {},
				userMeta: { userId: admin2.id, isAuth: true, isWrongJwt: false },
			});

			expect(res.status).to.equal(HttpStatus.OK);
			expect(res.body).to.be.an('array').with.length(4);
		});

		it('Regular user only sees their own connections, ignoring filters', async () => {
			const res = await sdk.getHrConnections({
				params: { student_user_id: user1.id },
				userMeta: { userId: user2.id, isAuth: true, isWrongJwt: false },
			});

			expect(res.status).to.equal(HttpStatus.OK);
			expect(res.body).to.be.an('array').with.length(2);
			for (const conn of res.body) {
				expect(conn.student_user_id).to.equal(user2.id);
			}
		});

		it('Regular user without filters sees only own connections', async () => {
			const res = await sdk.getHrConnections({
				params: {},
				userMeta: { userId: user3.id, isAuth: true, isWrongJwt: false },
			});

			expect(res.status).to.equal(HttpStatus.OK);
			expect(res.body).to.be.an('array').with.length(1);
			expect(res.body[0].student_user_id).to.equal(user3.id);
		});
	});
});
