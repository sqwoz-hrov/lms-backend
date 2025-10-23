import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { expect } from 'chai';
import { createTestTaskForMultipleUsersDto } from '../../../../test/fixtures/task.fixture';
import { createTestAdmin, createTestUser } from '../../../../test/fixtures/user.fixture';
import { ISharedContext } from '../../../../test/setup/test.app-setup';
import { TestHttpClient } from '../../../../test/test.http-client';
import { jwtConfig } from '../../../config';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { UsersTestRepository } from '../../../user/test-utils/test.repo';
import { TasksTestRepository } from '../../test-utils/test.repo';
import { TasksTestSdk } from '../../test-utils/test.sdk';

describe('[E2E] Create tasks for multiple students usecase', () => {
	let app: INestApplication;

	let userUtilRepository: UsersTestRepository;
	let taskUtilRepository: TasksTestRepository;
	let taskTestSdk: TasksTestSdk;

	before(function (this: ISharedContext) {
		app = this.app;
		const kysely = app.get(DatabaseProvider);
		userUtilRepository = new UsersTestRepository(kysely);
		taskUtilRepository = new TasksTestRepository(kysely);

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
	});

	it('Unauthenticated gets 401', async () => {
		const admin = await createTestAdmin(userUtilRepository);
		const student = await createTestUser(userUtilRepository);

		const dto = createTestTaskForMultipleUsersDto([student.id], admin.id);

		const res = await taskTestSdk.createTasksForMultipleStudents({
			params: dto,
			userMeta: {
				isAuth: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Fake jwt gets 401', async () => {
		const admin = await createTestAdmin(userUtilRepository);
		const student = await createTestUser(userUtilRepository);

		const dto = createTestTaskForMultipleUsersDto([student.id], admin.id);

		const res = await taskTestSdk.createTasksForMultipleStudents({
			params: dto,
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongAccessJwt: true,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Non-admin gets 401', async () => {
		const student = await createTestUser(userUtilRepository);
		const dto = createTestTaskForMultipleUsersDto([student.id]);

		const res = await taskTestSdk.createTasksForMultipleStudents({
			params: dto,
			userMeta: {
				userId: student.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Admin can create tasks for multiple students', async () => {
		const studentOne = await createTestUser(userUtilRepository);
		const studentTwo = await createTestUser(userUtilRepository);
		const admin = await createTestAdmin(userUtilRepository);

		const dto = createTestTaskForMultipleUsersDto([studentOne.id, studentTwo.id], admin.id);

		const res = await taskTestSdk.createTasksForMultipleStudents({
			params: dto,
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.CREATED);
		if (res.status != 201) throw new Error();
		expect(res.body).to.be.an('array');
		expect(res.body).to.have.length(2);

		const studentsInResponse = res.body.map(task => task.student_user_id);

		expect(studentsInResponse).to.have.members([studentOne.id, studentTwo.id]);
		expect(res.body.every(task => task.summary === dto.summary)).to.equal(true);
		expect(res.body.every(task => task.mentor_user_id === dto.mentor_user_id)).to.equal(true);
	});
});
