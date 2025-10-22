import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { expect } from 'chai';
import { v7 } from 'uuid';
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

describe('[E2E] Change task status usecase', () => {
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
				{ port: 3000, host: 'http://127.0.0.1' },
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
			userMeta: { userId: admin.id, isAuth: false, isWrongAccessJwt: false },
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
			userMeta: { userId: admin.id, isAuth: true, isWrongAccessJwt: true },
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
			userMeta: { userId: student1.id, isAuth: true, isWrongAccessJwt: false },
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
			userMeta: { userId: student.id, isAuth: true, isWrongAccessJwt: false },
		});
		expect(res.status).to.equal(HttpStatus.OK);
		if (res.status != 200) throw new Error();
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
			userMeta: { userId: admin.id, isAuth: true, isWrongAccessJwt: false },
		});
		expect(res.status).to.equal(HttpStatus.OK);
		if (res.status != 200) throw new Error();
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
			userMeta: { userId: admin.id, isAuth: true, isWrongAccessJwt: false },
		});
		expect(res.status).to.equal(HttpStatus.OK);
		if (res.status != 200) throw new Error();
		expect(res.body.status).to.equal('done');
	});

	it('Changing status of nonexistent task', async () => {
		const admin = await createTestAdmin(userUtilRepository);

		const res = await taskTestSdk.changeTaskStatus({
			params: { id: v7(), status: 'done' },
			userMeta: { userId: admin.id, isAuth: true, isWrongAccessJwt: false },
		});
		expect(res.status).to.equal(HttpStatus.NOT_FOUND);
	});
});
