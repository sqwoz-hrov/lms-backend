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
import { createTestAdmin, createTestUser } from '../../../../test/fixtures/create-test-user.fixture';
import { UsersTestRepository } from '../../../users/test-utils/test.repo';
import { UserModule } from '../../../users/user.module';
import { TelegramModule } from '../../../telegram/telegram.module';
import { MarkdownContentModule } from '../../../markdown-content/markdown-content.module';
import { createTestTask } from '../../../../test/fixtures/create-test-task.fixture';
import { MarkDownContentTestRepository } from '../../../markdown-content/test-utils/test.repo';

describe('[E2E] Delete task usecase', () => {
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

	it('Unauthenticated request gets 401', async () => {
		const admin = await createTestAdmin(userUtilRepository);

		const task = await createTestTask(userUtilRepository, markdownContentUtilRepository, taskUtilRepository);

		const res = await taskTestSdk.deleteTask({
			params: { id: task.id },
			userMeta: {
				userId: admin.id,
				isAuth: false,
				isWrongJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Non-admin gets 401', async () => {
		const user = await createTestUser(userUtilRepository);

		const task = await createTestTask(userUtilRepository, markdownContentUtilRepository, taskUtilRepository);

		const res = await taskTestSdk.deleteTask({
			params: { id: task.id },
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

		const res = await taskTestSdk.deleteTask({
			params: { id: task.id },
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongJwt: true,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Admin can delete a task', async () => {
		const admin = await createTestAdmin(userUtilRepository);

		const task = await createTestTask(userUtilRepository, markdownContentUtilRepository, taskUtilRepository);

		const res = await taskTestSdk.deleteTask({
			params: { id: task.id },
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.OK);

		const found = await taskUtilRepository.connection
			.selectFrom('task')
			.selectAll()
			.where('id', '=', task.id)
			.executeTakeFirst();
		expect(found).to.equal(undefined);
	});
});
