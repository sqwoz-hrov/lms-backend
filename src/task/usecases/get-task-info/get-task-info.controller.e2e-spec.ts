import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { StartedRedisContainer } from '@testcontainers/redis';
import { expect } from 'chai';
import { createTestTask } from '../../../../test/fixtures/task.fixture';
import { createTestAdmin, createTestUser } from '../../../../test/fixtures/user.fixture';
import { setupTestApplication } from '../../../../test/test.app-setup';
import { TestHttpClient } from '../../../../test/test.http-client';
import { jwtConfig } from '../../../config';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { MarkdownContentModule } from '../../../markdown-content/markdown-content.module';
import { TelegramModule } from '../../../telegram/telegram.module';
import { UsersTestRepository } from '../../../user/test-utils/test.repo';
import { UserModule } from '../../../user/user.module';
import { TaskModule } from '../../task.module';
import { TasksTestRepository } from '../../test-utils/test.repo';
import { TasksTestSdk } from '../../test-utils/test.sdk';
import { MarkDownContentTestRepository } from '../../../markdown-content/test-utils/test.repo';

describe('[E2E] Get task usecase', () => {
	let app: INestApplication;
	let postgresqlContainer: StartedPostgreSqlContainer;
	let redisContainer: StartedRedisContainer;

	let userUtilRepository: UsersTestRepository;
	let taskUtilRepository: TasksTestRepository;
	let markdownContentUtilRepository: MarkDownContentTestRepository;
	let taskTestSdk: TasksTestSdk;

	before(async () => {
		({ app, postgresqlContainer, redisContainer } = await setupTestApplication({
			imports: [MarkdownContentModule, TaskModule, UserModule, TelegramModule.forRoot({ useTelegramAPI: false })],
		}));
		const kysely = app.get(DatabaseProvider);
		userUtilRepository = new UsersTestRepository(kysely);
		taskUtilRepository = new TasksTestRepository(kysely);
		markdownContentUtilRepository = new MarkDownContentTestRepository(kysely);

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
		await markdownContentUtilRepository.clearAll();
	});

	after(async () => {
		await app.close();
		await postgresqlContainer.stop();
		await redisContainer.stop();
	});

	it('Unauthenticated gets 401', async () => {
		const admin = await createTestAdmin(userUtilRepository);

		const task = await createTestTask(userUtilRepository, markdownContentUtilRepository, taskUtilRepository);

		const res = await taskTestSdk.getTaskInfo({
			params: {
				id: task.id,
			},
			userMeta: {
				userId: admin.id,
				isAuth: false,
				isWrongJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Fake JWT gets 401', async () => {
		const admin = await createTestAdmin(userUtilRepository);

		const task = await createTestTask(userUtilRepository, markdownContentUtilRepository, taskUtilRepository);

		const res = await taskTestSdk.getTaskInfo({
			params: {
				id: task.id,
			},
			userMeta: {
				userId: admin.id,
				isAuth: false,
				isWrongJwt: true,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Admin can access task authored by him and assigned to him', async () => {
		const admin = await createTestAdmin(userUtilRepository);

		const task = await createTestTask(
			userUtilRepository,
			markdownContentUtilRepository,
			taskUtilRepository,
			{},
			{},
			{
				mentor_user_id: admin.id,
				student_user_id: admin.id,
			},
		);

		const res = await taskTestSdk.getTaskInfo({
			params: {
				id: task.id,
			},
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.OK);
	});

	it('Admin can access task authored by him but assigned to someone else', async () => {
		const admin = await createTestAdmin(userUtilRepository);

		const task = await createTestTask(
			userUtilRepository,
			markdownContentUtilRepository,
			taskUtilRepository,
			{},
			{},
			{
				mentor_user_id: admin.id,
			},
		);

		const res = await taskTestSdk.getTaskInfo({
			params: {
				id: task.id,
			},
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.OK);
	});

	it('Admin can access task authored by someone else and assigned to someone else', async () => {
		const admin = await createTestAdmin(userUtilRepository);

		const task = await createTestTask(userUtilRepository, markdownContentUtilRepository, taskUtilRepository);

		const res = await taskTestSdk.getTaskInfo({
			params: {
				id: task.id,
			},
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.OK);
	});

	it('User can access task assigned to him', async () => {
		const user = await createTestUser(userUtilRepository);

		const task = await createTestTask(
			userUtilRepository,
			markdownContentUtilRepository,
			taskUtilRepository,
			{},
			{},
			{ student_user_id: user.id },
		);

		const res = await taskTestSdk.getTaskInfo({
			params: {
				id: task.id,
			},
			userMeta: {
				userId: user.id,
				isAuth: true,
				isWrongJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.OK);
	});

	it('User can not access task assigned to someone else', async () => {
		const user = await createTestUser(userUtilRepository);

		const task = await createTestTask(userUtilRepository, markdownContentUtilRepository, taskUtilRepository);

		const res = await taskTestSdk.getTaskInfo({
			params: {
				id: task.id,
			},
			userMeta: {
				userId: user.id,
				isAuth: true,
				isWrongJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});
});
