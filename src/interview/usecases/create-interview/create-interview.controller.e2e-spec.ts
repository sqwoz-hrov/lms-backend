import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { expect } from 'chai';
import { createTestHrConnection } from '../../../../test/fixtures/hr-connection.fixture';
import { createTestInterviewDto } from '../../../../test/fixtures/interview.fixture';
import { createTestAdmin, createTestUser } from '../../../../test/fixtures/user.fixture';
import { ISharedContext } from '../../../../test/setup/test.app-setup';
import { TestHttpClient } from '../../../../test/test.http-client';
import { jwtConfig } from '../../../config';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { UsersTestRepository } from '../../../user/test-utils/test.repo';
import { HrConnectionsTestRepository } from '../../../hr-connection/test-utils/test.repo';
import { InterviewsTestRepository } from '../../test-utils/test.repo';
import { InterviewsTestSdk } from '../../test-utils/test.sdk';

describe('[E2E] Create Interview usecase', () => {
	let app: INestApplication;

	let userUtilRepo: UsersTestRepository;
	let hrUtilRepo: HrConnectionsTestRepository;
	let interviewUtilRepo: InterviewsTestRepository;
	let interviewTestSdk: InterviewsTestSdk;

	before(function (this: ISharedContext) {
		app = this.app;
		const kysely = app.get(DatabaseProvider);

		userUtilRepo = new UsersTestRepository(kysely);
		hrUtilRepo = new HrConnectionsTestRepository(kysely);
		interviewUtilRepo = new InterviewsTestRepository(kysely);

		interviewTestSdk = new InterviewsTestSdk(
			new TestHttpClient(
				{ port: 3000, host: 'http://127.0.0.1' },
				app.get<ConfigType<typeof jwtConfig>>(jwtConfig.KEY),
			),
		);
	});

	afterEach(async () => {
		await interviewUtilRepo.clearAll();
		await hrUtilRepo.clearAll();
		await userUtilRepo.clearAll();
	});

	it('Unauthenticated gets 401', async () => {
		const user = await createTestUser(userUtilRepo);
		const hrConnection = await createTestHrConnection(userUtilRepo, hrUtilRepo, {
			hrConnection: { student_user_id: user.id },
		});
		const dto = createTestInterviewDto(hrConnection.id);

		const res = await interviewTestSdk.createInterview({
			params: dto,
			userMeta: { userId: user.id, isAuth: false, isWrongAccessJwt: false },
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Fake jwt gets 401', async () => {
		const user = await createTestUser(userUtilRepo);
		const hrConnection = await createTestHrConnection(userUtilRepo, hrUtilRepo, {
			hrConnection: { student_user_id: user.id },
		});
		const dto = createTestInterviewDto(hrConnection.id);

		const res = await interviewTestSdk.createInterview({
			params: dto,
			userMeta: { userId: user.id, isAuth: true, isWrongAccessJwt: true },
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it("User cannot create interview for another student's HR connection", async () => {
		const user = await createTestUser(userUtilRepo);
		const anotherUser = await createTestUser(userUtilRepo);
		const hrConnection = await createTestHrConnection(userUtilRepo, hrUtilRepo, {
			hrConnection: { student_user_id: anotherUser.id },
		});
		const dto = createTestInterviewDto(hrConnection.id);

		const res = await interviewTestSdk.createInterview({
			params: dto,
			userMeta: { userId: user.id, isAuth: true, isWrongAccessJwt: false },
		});

		expect(res.status).to.equal(HttpStatus.FORBIDDEN);
	});

	it('Admin can create interview for any HR connection', async () => {
		const admin = await createTestAdmin(userUtilRepo);
		const student = await createTestUser(userUtilRepo);
		const hrConnection = await createTestHrConnection(userUtilRepo, hrUtilRepo, {
			hrConnection: { student_user_id: student.id },
		});
		const dto = createTestInterviewDto(hrConnection.id);

		const res = await interviewTestSdk.createInterview({
			params: dto,
			userMeta: { userId: admin.id, isAuth: true, isWrongAccessJwt: false },
		});

		expect(res.status).to.equal(HttpStatus.CREATED);
		expect(res.body.hr_connection_id).to.equal(hrConnection.id);
		expect(res.body.name).to.equal(dto.name);
		expect(res.body.type).to.equal(dto.type);
	});

	it('User can create interview for their own HR connection', async () => {
		const student = await createTestUser(userUtilRepo);
		const hrConnection = await createTestHrConnection(userUtilRepo, hrUtilRepo, {
			hrConnection: { student_user_id: student.id },
		});
		const dto = createTestInterviewDto(hrConnection.id);

		const res = await interviewTestSdk.createInterview({
			params: dto,
			userMeta: { userId: student.id, isAuth: true, isWrongAccessJwt: false },
		});

		expect(res.status).to.equal(HttpStatus.CREATED);
		expect(res.body.hr_connection_id).to.equal(hrConnection.id);
		expect(res.body.name).to.equal(dto.name);
		expect(res.body.type).to.equal(dto.type);
	});
});
