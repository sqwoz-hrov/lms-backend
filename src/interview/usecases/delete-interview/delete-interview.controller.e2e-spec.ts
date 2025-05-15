import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { expect } from 'chai';
import { v7 } from 'uuid';
import { createTestAdmin, createTestUser } from '../../../../test/fixtures/user.fixture';
import { ISharedContext } from '../../../../test/test.app-setup';
import { TestHttpClient } from '../../../../test/test.http-client';
import { jwtConfig } from '../../../config';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { UsersTestRepository } from '../../../user/test-utils/test.repo';
import { HrConnectionsTestRepository } from '../../../hr-connection/test-utils/test.repo';
import { InterviewsTestRepository } from '../../test-utils/test.repo';
import { InterviewsTestSdk } from '../../test-utils/test.sdk';
import { InterviewAggregateBuilder } from '../../../../test/fixtures/interview.fixture';

describe('[E2E] Delete Interview usecase', () => {
	let app: INestApplication;

	let userUtilRepo: UsersTestRepository;
	let hrUtilRepo: HrConnectionsTestRepository;
	let interviewUtilRepo: InterviewsTestRepository;

	let interviewTestSdk: InterviewsTestSdk;

	let interviewBuilder: InterviewAggregateBuilder;

	before(function (this: ISharedContext) {
		app = this.app;
		const kysely = app.get(DatabaseProvider);

		userUtilRepo = new UsersTestRepository(kysely);
		hrUtilRepo = new HrConnectionsTestRepository(kysely);
		interviewUtilRepo = new InterviewsTestRepository(kysely);

		interviewTestSdk = new InterviewsTestSdk(
			new TestHttpClient({ port: 3000, host: 'http://127.0.0.1' }),
			app.get<ConfigType<typeof jwtConfig>>(jwtConfig.KEY),
		);

		interviewBuilder = new InterviewAggregateBuilder(userUtilRepo, hrUtilRepo, interviewUtilRepo);
	});

	afterEach(async () => {
		await interviewUtilRepo.clearAll();
		await hrUtilRepo.clearAll();
		await userUtilRepo.clearAll();
	});

	it('Unauthenticated request gets 401', async () => {
		const user = await createTestUser(userUtilRepo);
		const interview = await interviewBuilder.createInterview({
			hrConnection: { student_user_id: user.id },
		});

		const res = await interviewTestSdk.deleteInterview({
			params: { id: interview.id },
			userMeta: { userId: user.id, isAuth: false, isWrongJwt: false },
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Fake JWT gets 401', async () => {
		const user = await createTestUser(userUtilRepo);
		const interview = await interviewBuilder.createInterview({
			hrConnection: { student_user_id: user.id },
		});

		const res = await interviewTestSdk.deleteInterview({
			params: { id: interview.id },
			userMeta: { userId: user.id, isAuth: true, isWrongJwt: true },
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('User can delete their interview', async () => {
		const user = await createTestUser(userUtilRepo);
		const interview = await interviewBuilder.createInterview({
			hrConnection: { student_user_id: user.id },
		});

		const res = await interviewTestSdk.deleteInterview({
			params: { id: interview.id },
			userMeta: { userId: user.id, isAuth: true, isWrongJwt: false },
		});

		expect(res.status).to.equal(HttpStatus.OK);
		expect(res.body.id).to.equal(interview.id);
	});

	it(`User can't delete another student's interview`, async () => {
		const owner = await createTestUser(userUtilRepo);
		const anotherUser = await createTestUser(userUtilRepo);
		const interview = await interviewBuilder.createInterview({
			hrConnection: { student_user_id: owner.id },
		});

		const res = await interviewTestSdk.deleteInterview({
			params: { id: interview.id },
			userMeta: { userId: anotherUser.id, isAuth: true, isWrongJwt: false },
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Admin can delete any interview', async () => {
		const admin = await createTestAdmin(userUtilRepo);
		const student = await createTestUser(userUtilRepo);
		const interview = await interviewBuilder.createInterview({
			hrConnection: { student_user_id: student.id },
		});

		const res = await interviewTestSdk.deleteInterview({
			params: { id: interview.id },
			userMeta: { userId: admin.id, isAuth: true, isWrongJwt: false },
		});

		expect(res.status).to.equal(HttpStatus.OK);
		expect(res.body.id).to.equal(interview.id);
	});

	it('Deleting non-existent interview returns 404', async () => {
		const user = await createTestUser(userUtilRepo);

		const res = await interviewTestSdk.deleteInterview({
			params: { id: v7() },
			userMeta: { userId: user.id, isAuth: true, isWrongJwt: false },
		});

		expect(res.status).to.equal(HttpStatus.NOT_FOUND);
	});
});
