import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { StartedRedisContainer } from '@testcontainers/redis';
import { setupTestApplication } from '../../../../test/test.app-setup';
import { TestHttpClient } from '../../../../test/test.http-client';
import { jwtConfig } from '../../../config';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { TaskModule } from '../../task.module';
import { TasksTestRepository } from '../../test-utils/test.repo';
import { TasksTestSdk } from '../../test-utils/test.sdk';
import { expect } from 'chai';
import { createTestAdmin, createTestUser } from '../../../../test/fixtures/user.fixture';
import { UsersTestRepository } from '../../../users/test-utils/test.repo';
import { UserModule } from '../../../users/user.module';
import { TelegramModule } from '../../../telegram/telegram.module';
import { MarkdownContentModule } from '../../../markdown-content/markdown-content.module';
import { createTestTaskDto } from '../../../../test/fixtures/task.fixture';

describe('[E2E] Ceate task usecase', () => {
	let app: INestApplication;
	let postgresqlContainer: StartedPostgreSqlContainer;
	let redisContainer: StartedRedisContainer;

	let userUtilRepository: UsersTestRepository;
	let taskUtilRepository: TasksTestRepository;
	let taskTestSdk: TasksTestSdk;

	before(async () => {
		({ app, postgresqlContainer, redisContainer } = await setupTestApplication({
			imports: [
				MarkdownContentModule.forRoot({ useRealImageStorage: false }),
				TaskModule,
				UserModule,
				TelegramModule.forRoot({ useTelegramAPI: false }),
			],
		}));
		const kysely = app.get(DatabaseProvider);
		userUtilRepository = new UsersTestRepository(kysely);
		taskUtilRepository = new TasksTestRepository(kysely);

		await app.init();
		await app.listen(3000);

		taskTestSdk = new TasksTestSdk(
			new TestHttpClient({
				port: 3000,
				host: 'http://127.0.0.1',
			}),
			app.get<ConfigType<typeof jwtConfig>>(jwtConfig.KEY),
		);
	});

	afterEach(async () => {
		await userUtilRepository.clearAll();
		await taskUtilRepository.clearAll();
	});

	after(async () => {
		await app.close();
		await postgresqlContainer.stop();
		await redisContainer.stop();
	});

	it('Unauthed gets 401', async () => {
		const author = await createTestAdmin(userUtilRepository);
		const task = createTestTaskDto(author.id);

		const res = await taskTestSdk.createTask({
			params: task,
			userMeta: {
				userId: author.id,
				isAuth: false,
				isWrongJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Non-admin gets 401', async () => {
		const user = await createTestUser(userUtilRepository);
		const task = createTestTaskDto(user.id);

		const res = await taskTestSdk.createTask({
			params: task,
			userMeta: {
				userId: user.id,
				isAuth: true,
				isWrongJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Fake jwt gets 401', async () => {
		const author = await createTestAdmin(userUtilRepository);
		const task = createTestTaskDto(author.id);

		const res = await taskTestSdk.createTask({
			params: task,
			userMeta: {
				userId: author.id,
				isAuth: true,
				isWrongJwt: true,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Admin can create task', async () => {
		const user = await createTestUser(userUtilRepository);
		const admin = await createTestAdmin(userUtilRepository);

		const task = createTestTaskDto(user.id, admin.id);

		const res = await taskTestSdk.createTask({
			params: task,
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.CREATED);
		expect(res.body.summary).to.equal(task.summary);
		expect(res.body.student_user_id).to.equal(task.student_user_id);
		expect(res.body.mentor_user_id).to.equal(task.mentor_user_id);
		expect(res.body.status).to.equal(task.status);
	});

	it('User can not create task', async () => {
		const user = await createTestUser(userUtilRepository);

		const task = createTestTaskDto(user.id, user.id);

		const res = await taskTestSdk.createTask({
			params: task,
			userMeta: {
				userId: user.id,
				isAuth: true,
				isWrongJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});
});
