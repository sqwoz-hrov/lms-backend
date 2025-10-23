import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { expect } from 'chai';
import { FeedbackAggregateBuilder } from '../../../../test/fixtures/feedback.fixture';
import { createTestAdmin, createTestUser } from '../../../../test/fixtures/user.fixture';
import { ISharedContext } from '../../../../test/setup/test.app-setup';
import { TestHttpClient } from '../../../../test/test.http-client';
import { jwtConfig } from '../../../config';
import { HrConnectionsTestRepository } from '../../../hr-connection/test-utils/test.repo';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { InterviewsTestRepository } from '../../../interview/test-utils/test.repo';
import { MarkDownContentTestRepository } from '../../../markdown-content/test-utils/test.repo';
import { UsersTestRepository } from '../../../user/test-utils/test.repo';
import { FeedbacksTestRepository } from '../../test-utils/test.repo';
import { FeedbackTestSdk } from '../../test-utils/test.sdk';
import { Feedback } from '../../feedback.entity';

describe('[E2E] Get All Feedback usecase', () => {
	let app: INestApplication;

	let userUtilRepo: UsersTestRepository;
	let hrUtilRepo: HrConnectionsTestRepository;
	let interviewUtilRepo: InterviewsTestRepository;
	let markdownContentUtilRepo: MarkDownContentTestRepository;
	let feedbackUtilRepo: FeedbacksTestRepository;

	let feedbackSdk: FeedbackTestSdk;

	let feedbackBuilder: FeedbackAggregateBuilder;

	before(function (this: ISharedContext) {
		app = this.app;
		const kysely = app.get(DatabaseProvider);

		userUtilRepo = new UsersTestRepository(kysely);
		hrUtilRepo = new HrConnectionsTestRepository(kysely);
		interviewUtilRepo = new InterviewsTestRepository(kysely);
		markdownContentUtilRepo = new MarkDownContentTestRepository(kysely);
		feedbackUtilRepo = new FeedbacksTestRepository(kysely);

		feedbackSdk = new FeedbackTestSdk(
			new TestHttpClient(
				{ port: 3000, host: 'http://127.0.0.1' },
				app.get<ConfigType<typeof jwtConfig>>(jwtConfig.KEY),
			),
		);

		feedbackBuilder = new FeedbackAggregateBuilder(
			userUtilRepo,
			hrUtilRepo,
			interviewUtilRepo,
			feedbackUtilRepo,
			markdownContentUtilRepo,
		);
	});

	afterEach(async () => {
		await feedbackUtilRepo.clearAll();
		await interviewUtilRepo.clearAll();
		await hrUtilRepo.clearAll();
		await userUtilRepo.clearAll();
		await markdownContentUtilRepo.clearAll();
	});

	it('Unauthenticated gets 401', async () => {
		const res = await feedbackSdk.getAllFeedback({
			params: {},
			userMeta: { isAuth: false },
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Fake JWT gets 401', async () => {
		const user = await createTestUser(userUtilRepo);

		const res = await feedbackSdk.getAllFeedback({
			params: {},
			userMeta: { userId: user.id, isAuth: true, isWrongAccessJwt: true },
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	describe('Access control and filtering', () => {
		let admin: Awaited<ReturnType<typeof createTestAdmin>>;
		let user1: Awaited<ReturnType<typeof createTestUser>>;
		let user2: Awaited<ReturnType<typeof createTestUser>>;

		let feedback1_user1: { feedback_id: string; interview_id: string };
		let feedback2_user1: { feedback_id: string; interview_id: string };
		let feedback1_user2: { feedback_id: string; interview_id: string };

		beforeEach(async () => {
			admin = await createTestAdmin(userUtilRepo);
			user1 = await createTestUser(userUtilRepo);
			user2 = await createTestUser(userUtilRepo);

			const fb1 = await feedbackBuilder.createFeedback({
				hrConnection: { student_user_id: user1.id },
				interview: { name: 'Interview A' },
			});
			feedback1_user1 = { feedback_id: fb1.id, interview_id: fb1.interview_id };

			const fb2 = await feedbackBuilder.createFeedback({
				hrConnection: { student_user_id: user1.id },
				interview: { name: 'Interview B' },
			});
			feedback2_user1 = { feedback_id: fb2.id, interview_id: fb2.interview_id };

			const fb3 = await feedbackBuilder.createFeedback({
				hrConnection: { student_user_id: user2.id },
				interview: { name: 'Interview C' },
			});
			feedback1_user2 = { feedback_id: fb3.id, interview_id: fb3.interview_id };
		});

		it('Admin sees all feedbacks', async () => {
			const res = await feedbackSdk.getAllFeedback({
				params: {},
				userMeta: { userId: admin.id, isAuth: true, isWrongAccessJwt: false },
			});

			expect(res.status).to.equal(HttpStatus.OK);
			if (res.status != 200) throw new Error();
			expect(res.body).to.be.an('array').with.length(3);

			const feedbackIds = res.body.map((f: Feedback) => f.id);
			expect(feedbackIds).to.include.members([
				feedback1_user1.feedback_id,
				feedback2_user1.feedback_id,
				feedback1_user2.feedback_id,
			]);
		});

		it('User sees only their own feedbacks', async () => {
			const res = await feedbackSdk.getAllFeedback({
				params: {},
				userMeta: { userId: user1.id, isAuth: true, isWrongAccessJwt: false },
			});

			expect(res.status).to.equal(HttpStatus.OK);
			if (res.status != 200) throw new Error();
			expect(res.body).to.be.an('array').with.length(2);

			const feedbackIds = res.body.map((f: Feedback) => f.id);
			expect(feedbackIds).to.include.members([feedback1_user1.feedback_id, feedback2_user1.feedback_id]);
			expect(feedbackIds).to.not.include(feedback1_user2.feedback_id);
		});

		it('User cannot filter using someone else’s interview_id', async () => {
			const res = await feedbackSdk.getAllFeedback({
				params: { interview_id: feedback1_user2.interview_id },
				userMeta: { userId: user1.id, isAuth: true, isWrongAccessJwt: false },
			});

			expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
		});
	});
});
