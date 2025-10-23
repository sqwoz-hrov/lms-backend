import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { expect } from 'chai';
import { randomWord } from '../../../../test/fixtures/common.fixture';
import { createTestTask } from '../../../../test/fixtures/task.fixture';
import { createTestAdmin, createTestUser } from '../../../../test/fixtures/user.fixture';
import { ISharedContext } from '../../../../test/setup/test.app-setup';
import { TestHttpClient } from '../../../../test/test.http-client';
import { jwtConfig } from '../../../config';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { MarkDownContentTestRepository } from '../../../markdown-content/test-utils/test.repo';
import { UsersTestRepository } from '../../../user/test-utils/test.repo';
import { UpdateTaskDto } from '../../dto/update-task.dto';
import { TasksTestRepository } from '../../test-utils/test.repo';
import { TasksTestSdk } from '../../test-utils/test.sdk';

describe('[E2E] Edit task usecase', () => {
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

	it('Unauthenticated gets 401', async () => {
		const task = await createTestTask(userUtilRepository, markdownContentUtilRepository, taskUtilRepository);

		const editDto: UpdateTaskDto = {
			id: task.id,
			summary: randomWord(),
			status: 'in_progress',
		};

		const res = await taskTestSdk.editTask({
			params: editDto,
			userMeta: {
				isAuth: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Fake JWT gets 401', async () => {
		const task = await createTestTask(userUtilRepository, markdownContentUtilRepository, taskUtilRepository);

		const editDto: UpdateTaskDto = {
			id: task.id,
			summary: randomWord(),
			status: 'in_progress',
		};

		const res = await taskTestSdk.editTask({
			params: editDto,
			userMeta: {
				isAuth: false,
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
				isWrongAccessJwt: false,
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
				isWrongAccessJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.OK);
		if (res.status != 200) throw new Error();
		expect(res.body.summary).to.equal(newSummary);
		expect(res.body.status).to.equal(editDto.status);
	});
});
