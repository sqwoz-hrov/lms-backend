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
import { User } from '../../../users/user.entity';

describe('[E2E] Get tasks usecase', () => {
	let app: INestApplication;
	let postgresqlContainer: StartedPostgreSqlContainer;
	let redisContainer: StartedRedisContainer;

	let userUtilRepository: UsersTestRepository;
	let taskUtilRepository: TasksTestRepository;
	let markdownContentUtilRepository: MarkDownContentTestRepository;
	let taskTestSdk: TasksTestSdk;

	const createTask = async ({
		mentor_user_id,
		student_user_id,
	}: {
		mentor_user_id?: string;
		student_user_id?: string;
	}) => {
		await createTestTask(
			userUtilRepository,
			markdownContentUtilRepository,
			taskUtilRepository,
			{},
			{},
			{
				mentor_user_id,
				student_user_id,
			},
		);
	};

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

		const res = await taskTestSdk.getTasks({
			params: {
				mentor_user_id: admin.id,
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

		const res = await taskTestSdk.getTasks({
			params: {
				mentor_user_id: admin.id,
			},
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongJwt: true,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	describe('Query filters tests', () => {
		let admin1: User;
		let admin2: User;
		let admin3: User;

		let user1: User;
		let user2: User;
		let user3: User;

		beforeEach(async () => {
			admin1 = await createTestAdmin(userUtilRepository);
			admin2 = await createTestAdmin(userUtilRepository);
			admin3 = await createTestAdmin(userUtilRepository);

			user1 = await createTestUser(userUtilRepository);
			user2 = await createTestUser(userUtilRepository);
			user3 = await createTestUser(userUtilRepository);

			// Tasks for admin1/student1
			await createTask({ mentor_user_id: admin1.id, student_user_id: user1.id });
			await createTask({ mentor_user_id: admin1.id, student_user_id: user2.id });

			// Tasks for admin2/student2
			await createTask({ mentor_user_id: admin2.id, student_user_id: user2.id });

			// Task for admin3/student3
			await createTask({ mentor_user_id: admin3.id, student_user_id: user3.id });
		});

		it('Admin can filter by mentor_user_id', async () => {
			const res = await taskTestSdk.getTasks({
				params: { mentor_user_id: admin1.id },
				userMeta: { userId: admin1.id, isAuth: true, isWrongJwt: false },
			});

			expect(res.status).to.equal(HttpStatus.OK);
			expect(res.body).to.be.an('array').with.length(2);
			for (const t of res.body) {
				expect(t.mentor_user_id).to.equal(admin1.id);
			}
		});

		it('Admin can filter by student_user_id', async () => {
			const res = await taskTestSdk.getTasks({
				params: { student_user_id: user2.id },
				userMeta: { userId: admin2.id, isAuth: true, isWrongJwt: false },
			});

			expect(res.status).to.equal(HttpStatus.OK);
			// user2 has 2 tasks: one under admin1 and one under admin2
			expect(res.body).to.be.an('array').with.length(2);
			for (const t of res.body) {
				expect(t.student_user_id).to.equal(user2.id);
			}
		});

		it('Admin without filters gets all tasks', async () => {
			const res = await taskTestSdk.getTasks({
				params: {},
				userMeta: { userId: admin3.id, isAuth: true, isWrongJwt: false },
			});

			expect(res.status).to.equal(HttpStatus.OK);
			// total tasks created above = 4
			expect(res.body).to.be.an('array').with.length(4);
		});

		it('Regular user only sees own tasks, ignoring other student_user_id filters', async () => {
			// user2 attempts to filter by user1.id but should only see their own tasks
			const res = await taskTestSdk.getTasks({
				params: { student_user_id: user1.id },
				userMeta: { userId: user2.id, isAuth: true, isWrongJwt: false },
			});

			expect(res.status).to.equal(HttpStatus.OK);
			// user2 has exactly 2 tasks in setup
			expect(res.body).to.be.an('array').with.length(2);
			for (const t of res.body) {
				expect(t.student_user_id).to.equal(user2.id);
			}
		});

		it('Regular user without any filters sees only own tasks', async () => {
			const res = await taskTestSdk.getTasks({
				params: {},
				userMeta: { userId: user3.id, isAuth: true, isWrongJwt: false },
			});

			expect(res.status).to.equal(HttpStatus.OK);
			// user3 has exactly 1 task
			expect(res.body).to.be.an('array').with.length(1);
			expect(res.body[0].student_user_id).to.equal(user3.id);
		});

		it('Admin can view tasks where student is another admin', async () => {
			// Create a task where admin1 mentors admin2
			await createTask({ mentor_user_id: admin1.id, student_user_id: admin2.id });

			const res = await taskTestSdk.getTasks({
				params: { student_user_id: admin2.id },
				userMeta: { userId: admin1.id, isAuth: true, isWrongJwt: false },
			});

			expect(res.status).to.equal(HttpStatus.OK);
			expect(res.body).to.be.an('array').with.length(1);
			expect(res.body[0].student_user_id).to.equal(admin2.id);
		});

		it('Regular user cannot override filters: always sees only own tasks (mentor filter dropped)', async () => {
			// Create two tasks for user1 but with different mentors
			await createTask({ mentor_user_id: admin1.id, student_user_id: user1.id });
			await createTask({ mentor_user_id: admin2.id, student_user_id: user1.id });

			// User1 tries to filter by someone else’s student_user_id and by mentor_user_id
			const res = await taskTestSdk.getTasks({
				params: { student_user_id: user2.id, mentor_user_id: admin3.id },
				userMeta: { userId: user1.id, isAuth: true, isWrongJwt: false },
			});

			expect(res.status).to.equal(HttpStatus.OK);
			// Should ignore both query params and return both of user1’s tasks
			expect(res.body).to.be.an('array').with.length(3);
			for (const t of res.body) {
				expect(t.student_user_id).to.equal(user1.id);
			}
		});
	});
});
