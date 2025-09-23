import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { expect } from 'chai';
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

describe('[E2E] Get Interviews usecase', () => {
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

	it('Unauthenticated gets 401', async () => {
		const user = await createTestUser(userUtilRepo);
		const res = await interviewTestSdk.getInterviews({
			params: {},
			userMeta: { userId: user.id, isAuth: false, isWrongAccessJwt: false },
		});
		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Fake JWT gets 401', async () => {
		const user = await createTestUser(userUtilRepo);
		const res = await interviewTestSdk.getInterviews({
			params: {},
			userMeta: { userId: user.id, isAuth: true, isWrongAccessJwt: true },
		});
		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	describe('Query filters and access control', () => {
		let admin: Awaited<ReturnType<typeof createTestAdmin>>;
		let user1: Awaited<ReturnType<typeof createTestUser>>;
		let user2: Awaited<ReturnType<typeof createTestUser>>;

		beforeEach(async () => {
			admin = await createTestAdmin(userUtilRepo);
			user1 = await createTestUser(userUtilRepo);
			user2 = await createTestUser(userUtilRepo);

			await interviewBuilder.createInterview({
				hrConnection: { student_user_id: user1.id },
				interview: { name: 'Interview A', type: 'screening' },
			});

			await interviewBuilder.createInterview({
				hrConnection: { student_user_id: user1.id },
				interview: { name: 'Interview B', type: 'technical_interview' },
			});

			await interviewBuilder.createInterview({
				hrConnection: { student_user_id: user2.id },
				interview: { name: 'Interview C', type: 'final' },
			});
		});

		it('Admin sees all interviews', async () => {
			const res = await interviewTestSdk.getInterviews({
				params: {},
				userMeta: { userId: admin.id, isAuth: true, isWrongAccessJwt: false },
			});
			expect(res.status).to.equal(HttpStatus.OK);
			expect(res.body).to.be.an('array').with.length(3);
		});

		it('User sees only their own interviews', async () => {
			const res = await interviewTestSdk.getInterviews({
				params: {},
				userMeta: { userId: user1.id, isAuth: true, isWrongAccessJwt: false },
			});
			expect(res.status).to.equal(HttpStatus.OK);
			expect(res.body).to.be.an('array').with.length(2);
			for (const interview of res.body) {
				expect(interview.name).to.match(/^Interview [AB]$/);
			}
		});

		it('User cannot use someone else’s hr_connection_id', async () => {
			const allInterviews = await interviewTestSdk.getInterviews({
				params: {},
				userMeta: { userId: admin.id, isAuth: true, isWrongAccessJwt: false },
			});
			const foreignHrId = allInterviews.body.find((i: any) => i.name === 'Interview A')?.hr_connection_id;

			const res = await interviewTestSdk.getInterviews({
				params: { hr_connection_id: foreignHrId },
				userMeta: { userId: user2.id, isAuth: true, isWrongAccessJwt: false },
			});

			expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
		});
	});
});
