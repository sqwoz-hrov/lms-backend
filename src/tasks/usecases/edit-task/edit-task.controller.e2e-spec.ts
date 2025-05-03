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
import { randomWord } from '../../../../test/fixtures/common.fixture';
import { UpdateTaskDto } from '../../dto/update-task.dto';
import { MarkDownContentTestRepository } from '../../../markdown-content/test-utils/test.repo';
import { createTestTask } from '../../../../test/fixtures/task.fixture';

describe('[E2E] Edit task usecase', () => {
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

		const editDto: UpdateTaskDto = {
			id: task.id,
			summary: randomWord(),
			status: 'in_progress',
		};

		const res = await taskTestSdk.editTask({
			params: editDto,
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

		const editDto: UpdateTaskDto = {
			id: task.id,
			summary: randomWord(),
			status: 'in_progress',
		};

		const res = await taskTestSdk.editTask({
			params: editDto,
			userMeta: {
				userId: admin.id,
				isAuth: false,
				isWrongJwt: true,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Non-admin gets 401', async () => {
		const user = await createTestUser(userUtilRepository);

		const task = await createTestTask(userUtilRepository, markdownContentUtilRepository, taskUtilRepository);

		const editDto: UpdateTaskDto = {
			id: task.id,
			summary: randomWord(),
			status: 'in_progress',
		};

		const res = await taskTestSdk.editTask({
			params: editDto,
			userMeta: {
				userId: user.id,
				isAuth: true,
				isWrongJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Fake JWT gets 401', async () => {
		const admin = await createTestAdmin(userUtilRepository);
		const task = await createTestTask(userUtilRepository, markdownContentUtilRepository, taskUtilRepository);

		const editDto: UpdateTaskDto = {
			id: task.id,
			summary: randomWord(),
			status: 'in_progress',
		};

		const res = await taskTestSdk.editTask({
			params: editDto,
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongJwt: true,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Admin can edit a task', async () => {
		const admin = await createTestAdmin(userUtilRepository);
		const task = await createTestTask(userUtilRepository, markdownContentUtilRepository, taskUtilRepository);

		const newSummary = randomWord();

		const editDto: UpdateTaskDto = {
			id: task.id,
			summary: newSummary,
			status: 'in_progress',
		};

		const res = await taskTestSdk.editTask({
			params: editDto,
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.OK);
		expect(res.body.summary).to.equal(newSummary);
		expect(res.body.status).to.equal(editDto.status);
	});
});
