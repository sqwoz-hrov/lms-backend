import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { expect } from 'chai';
import { v7 } from 'uuid';
import { createTestAdmin, createTestUser } from '../../../../test/fixtures/user.fixture';
import { ISharedContext } from '../../../../test/setup/test.app-setup';
import { TestHttpClient } from '../../../../test/test.http-client';
import { jwtConfig } from '../../../config';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { UsersTestRepository } from '../../../user/test-utils/test.repo';
import { HrConnectionsTestRepository } from '../../../hr-connection/test-utils/test.repo';
import { InterviewsTestRepository } from '../../test-utils/test.repo';
import { InterviewsTestSdk } from '../../test-utils/test.sdk';
import { InterviewAggregateBuilder } from '../../../../test/fixtures/interview.fixture';

describe('[E2E] Edit Interview usecase', () => {
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
			new TestHttpClient(
				{ port: 3000, host: 'http://127.0.0.1' },
				app.get<ConfigType<typeof jwtConfig>>(jwtConfig.KEY),
			),
		);

		interviewBuilder = new InterviewAggregateBuilder(userUtilRepo, hrUtilRepo, interviewUtilRepo);
	});

	afterEach(async () => {
		await interviewUtilRepo.clearAll();
		await hrUtilRepo.clearAll();
		await userUtilRepo.clearAll();
	});

	it('Unauthenticated user gets 401', async () => {
		const user = await createTestUser(userUtilRepo);
		const interview = await interviewBuilder.createInterview({
			hrConnection: { student_user_id: user.id },
		});

		const res = await interviewTestSdk.editInterview({
			params: { id: interview.id, name: 'New name' },
			userMeta: { userId: user.id, isAuth: false, isWrongAccessJwt: false },
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('User with fake JWT gets 401', async () => {
		const user = await createTestUser(userUtilRepo);
		const interview = await interviewBuilder.createInterview({
			hrConnection: { student_user_id: user.id },
		});

		const res = await interviewTestSdk.editInterview({
			params: { id: interview.id, name: 'New name' },
			userMeta: { userId: user.id, isAuth: true, isWrongAccessJwt: true },
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('User can edit their own interview', async () => {
		const user = await createTestUser(userUtilRepo);
		const interview = await interviewBuilder.createInterview({
			hrConnection: { student_user_id: user.id },
			interview: { name: 'Old name' },
		});

		const newComment = 'Updated name';

		const res = await interviewTestSdk.editInterview({
			params: { id: interview.id, name: newComment },
			userMeta: { userId: user.id, isAuth: true, isWrongAccessJwt: false },
		});

		expect(res.status).to.equal(HttpStatus.OK);
		if (res.status != 200) throw new Error();
		expect(res.body.name).to.equal(newComment);
	});

	it(`User can't edit another user's interview`, async () => {
		const owner = await createTestUser(userUtilRepo);
		const anotherUser = await createTestUser(userUtilRepo);
		const interview = await interviewBuilder.createInterview({
			hrConnection: { student_user_id: owner.id },
		});

		const res = await interviewTestSdk.editInterview({
			params: { id: interview.id, name: 'Should not be allowed' },
			userMeta: { userId: anotherUser.id, isAuth: true, isWrongAccessJwt: false },
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Admin can edit any interview', async () => {
		const admin = await createTestAdmin(userUtilRepo);
		const student = await createTestUser(userUtilRepo);
		const interview = await interviewBuilder.createInterview({
			hrConnection: { student_user_id: student.id },
		});

		const newComment = 'Admin updated this';

		const res = await interviewTestSdk.editInterview({
			params: { id: interview.id, name: newComment },
			userMeta: { userId: admin.id, isAuth: true, isWrongAccessJwt: false },
		});

		expect(res.status).to.equal(HttpStatus.OK);
		if (res.status != 200) throw new Error();
		expect(res.body.name).to.equal(newComment);
	});

	it('Editing non-existent interview returns 404', async () => {
		const user = await createTestUser(userUtilRepo);

		const res = await interviewTestSdk.editInterview({
			params: { id: v7(), name: 'Whatever' },
			userMeta: { userId: user.id, isAuth: true, isWrongAccessJwt: false },
		});

		expect(res.status).to.equal(HttpStatus.NOT_FOUND);
	});
});
