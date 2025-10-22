import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { expect } from 'chai';
import { createTestTask } from '../../../../test/fixtures/task.fixture';
import { createTestAdmin, createTestUser } from '../../../../test/fixtures/user.fixture';
import { ISharedContext } from '../../../../test/setup/test.app-setup';
import { TestHttpClient } from '../../../../test/test.http-client';
import { jwtConfig } from '../../../config';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { MarkDownContentTestRepository } from '../../../markdown-content/test-utils/test.repo';
import { UsersTestRepository } from '../../../user/test-utils/test.repo';
import { TasksTestRepository } from '../../test-utils/test.repo';
import { TasksTestSdk } from '../../test-utils/test.sdk';

describe('[E2E] Delete task usecase', () => {
	let app: INestApplication;

	let userUtilRepository: UsersTestRepository;
	let taskUtilRepository: TasksTestRepository;
	let markdownContentUtilRepository: MarkDownContentTestRepository;
	let taskTestSdk: TasksTestSdk;

	before(function (this: ISharedContext) {
		app = this.app;
		const kysely = app.get(DatabaseProvider);
		userUtilRepository = new UsersTestRepository(kysely);
		taskUtilRepository = new TasksTestRepository(kysely);
		markdownContentUtilRepository = new MarkDownContentTestRepository(kysely);

		taskTestSdk = new TasksTestSdk(
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
		await userUtilRepository.clearAll();
		await taskUtilRepository.clearAll();
		await markdownContentUtilRepository.clearAll();
	});

	it('Unauthenticated request gets 401', async () => {
		const admin = await createTestAdmin(userUtilRepository);

		const task = await createTestTask(userUtilRepository, markdownContentUtilRepository, taskUtilRepository);

		const res = await taskTestSdk.deleteTask({
			params: { id: task.id },
			userMeta: {
				userId: admin.id,
				isAuth: false,
				isWrongAccessJwt: false,
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
				isWrongAccessJwt: true,
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
				isWrongAccessJwt: false,
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
				isWrongAccessJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.OK);
		if (res.status != 200) throw new Error();

		const found = await taskUtilRepository.connection
			.selectFrom('task')
			.selectAll()
			.where('id', '=', task.id)
			.limit(1)
			.executeTakeFirst();
		expect(found).to.equal(undefined);
	});
});
