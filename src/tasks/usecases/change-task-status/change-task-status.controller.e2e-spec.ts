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
import { UsersTestRepository } from '../../../users/test-utils/test.repo';
import { UserModule } from '../../../users/user.module';
import { TaskModule } from '../../task.module';
import { TasksTestRepository } from '../../test-utils/test.repo';
import { TasksTestSdk } from '../../test-utils/test.sdk';
import { MarkDownContentTestRepository } from '../../../markdown-content/test-utils/test.repo';
import { v7 } from 'uuid';

describe('[E2E] Change task status usecase', () => {
	let app: INestApplication;
	let postgresqlContainer: StartedPostgreSqlContainer;
	let redisContainer: StartedRedisContainer;

	let userUtilRepository: UsersTestRepository;
	let taskUtilRepository: TasksTestRepository;
	let markdownContentUtilRepository: MarkDownContentTestRepository;
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
		markdownContentUtilRepository = new MarkDownContentTestRepository(kysely);

		await app.init();
		await app.listen(3000);

		taskTestSdk = new TasksTestSdk(
			new TestHttpClient({ port: 3000, host: 'http://127.0.0.1' }),
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
		const task = await createTestTask(
			userUtilRepository,
			markdownContentUtilRepository,
			taskUtilRepository,
			{},
			{},
			{ mentor_user_id: admin.id, student_user_id: admin.id },
		);

		const res = await taskTestSdk.changeTaskStatus({
			params: { id: task.id, status: 'done' },
			userMeta: { userId: admin.id, isAuth: false, isWrongJwt: false },
		});
		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Fake JWT gets 401', async () => {
		const admin = await createTestAdmin(userUtilRepository);
		const task = await createTestTask(
			userUtilRepository,
			markdownContentUtilRepository,
			taskUtilRepository,
			{},
			{},
			{ mentor_user_id: admin.id, student_user_id: admin.id },
		);

		const res = await taskTestSdk.changeTaskStatus({
			params: { id: task.id, status: 'done' },
			userMeta: { userId: admin.id, isAuth: true, isWrongJwt: true },
		});
		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Student cannot change status of a task not assigned to them', async () => {
		const student1 = await createTestUser(userUtilRepository);
		const student2 = await createTestUser(userUtilRepository);
		const task = await createTestTask(
			userUtilRepository,
			markdownContentUtilRepository,
			taskUtilRepository,
			{},
			{},
			{ student_user_id: student2.id, mentor_user_id: student2.id },
		);

		const res = await taskTestSdk.changeTaskStatus({
			params: { id: task.id, status: 'done' },
			userMeta: { userId: student1.id, isAuth: true, isWrongJwt: false },
		});
		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Student can change status of their own task', async () => {
		const student = await createTestUser(userUtilRepository);
		const task = await createTestTask(
			userUtilRepository,
			markdownContentUtilRepository,
			taskUtilRepository,
			{},
			{},
			{ student_user_id: student.id, mentor_user_id: student.id },
		);

		const res = await taskTestSdk.changeTaskStatus({
			params: { id: task.id, status: 'in_progress' },
			userMeta: { userId: student.id, isAuth: true, isWrongJwt: false },
		});
		expect(res.status).to.equal(HttpStatus.OK);
		expect(res.body.status).to.equal('in_progress');
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		expect(res.body.markdown_content).to.be.a('string').and.to.be.not.empty;
	});

	it('Admin can change status of their own task', async () => {
		const admin = await createTestAdmin(userUtilRepository);
		const task = await createTestTask(
			userUtilRepository,
			markdownContentUtilRepository,
			taskUtilRepository,
			{},
			{},
			{ student_user_id: admin.id, mentor_user_id: admin.id },
		);

		const res = await taskTestSdk.changeTaskStatus({
			params: { id: task.id, status: 'done' },
			userMeta: { userId: admin.id, isAuth: true, isWrongJwt: false },
		});
		expect(res.status).to.equal(HttpStatus.OK);
		expect(res.body.status).to.equal('done');
	});

	it('Admin can change status of any other user’s task', async () => {
		const admin = await createTestAdmin(userUtilRepository);
		const student = await createTestUser(userUtilRepository);
		const task = await createTestTask(
			userUtilRepository,
			markdownContentUtilRepository,
			taskUtilRepository,
			{},
			{},
			{ student_user_id: student.id, mentor_user_id: student.id },
		);

		const res = await taskTestSdk.changeTaskStatus({
			params: { id: task.id, status: 'done' },
			userMeta: { userId: admin.id, isAuth: true, isWrongJwt: false },
		});
		expect(res.status).to.equal(HttpStatus.OK);
		expect(res.body.status).to.equal('done');
	});

	it('Changing status of nonexistent task', async () => {
		const admin = await createTestAdmin(userUtilRepository);

		const res = await taskTestSdk.changeTaskStatus({
			params: { id: v7(), status: 'done' },
			userMeta: { userId: admin.id, isAuth: true, isWrongJwt: false },
		});
		expect(res.status).to.equal(HttpStatus.NOT_FOUND);
	});
});
