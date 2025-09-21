import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { expect } from 'chai';
import { v7 } from 'uuid';
import { FeedbackAggregateBuilder } from '../../../../test/fixtures/feedback.fixture';
import { createTestAdmin, createTestUser } from '../../../../test/fixtures/user.fixture';
import { ISharedContext } from '../../../../test/test.app-setup';
import { TestHttpClient } from '../../../../test/test.http-client';
import { jwtConfig } from '../../../config';
import { HrConnectionsTestRepository } from '../../../hr-connection/test-utils/test.repo';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { InterviewsTestRepository } from '../../../interview/test-utils/test.repo';
import { MarkDownContentTestRepository } from '../../../markdown-content/test-utils/test.repo';
import { UsersTestRepository } from '../../../user/test-utils/test.repo';
import { FeedbacksTestRepository } from '../../test-utils/test.repo';
import { FeedbackTestSdk } from '../../test-utils/test.sdk';

describe('[E2E] Get Feedback Info usecase', () => {
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
		const user = await createTestUser(userUtilRepo);
		const feedback = await feedbackBuilder.createFeedback({});

		const res = await feedbackSdk.getFeedbackInfo({
			params: { id: feedback.id },
			userMeta: { userId: user.id, isAuth: false, isWrongAccessJwt: false },
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Fake JWT gets 401', async () => {
		const user = await createTestUser(userUtilRepo);
		const feedback = await feedbackBuilder.createFeedback({});

		const res = await feedbackSdk.getFeedbackInfo({
			params: { id: feedback.id },
			userMeta: { userId: user.id, isAuth: true, isWrongAccessJwt: true },
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Non-admin cannot access another user feedback (401)', async () => {
		const user1 = await createTestUser(userUtilRepo);
		const user2 = await createTestUser(userUtilRepo);
		const fb = await feedbackBuilder.createFeedback({ hrConnection: { student_user_id: user2.id } });

		const res = await feedbackSdk.getFeedbackInfo({
			params: { id: fb.id },
			userMeta: { userId: user1.id, isAuth: true, isWrongAccessJwt: false },
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Admin can access any feedback', async () => {
		const admin = await createTestAdmin(userUtilRepo);
		const user = await createTestUser(userUtilRepo);
		const fb = await feedbackBuilder.createFeedback({ hrConnection: { student_user_id: user.id } });

		const res = await feedbackSdk.getFeedbackInfo({
			params: { id: fb.id },
			userMeta: { userId: admin.id, isAuth: true, isWrongAccessJwt: false },
		});

		expect(res.status).to.equal(HttpStatus.OK);
		expect(res.body.id).to.equal(fb.id);
	});

	it('Owner can access their own feedback', async () => {
		const user = await createTestUser(userUtilRepo);
		const fb = await feedbackBuilder.createFeedback({ hrConnection: { student_user_id: user.id } });

		const res = await feedbackSdk.getFeedbackInfo({
			params: { id: fb.id },
			userMeta: { userId: user.id, isAuth: true, isWrongAccessJwt: false },
		});

		expect(res.status).to.equal(HttpStatus.OK);
		expect(res.body.id).to.equal(fb.id);
	});

	it('Non-existent feedback returns 404', async () => {
		const admin = await createTestAdmin(userUtilRepo);

		const res = await feedbackSdk.getFeedbackInfo({
			params: { id: v7() },
			userMeta: { userId: admin.id, isAuth: true, isWrongAccessJwt: false },
		});

		expect(res.status).to.equal(HttpStatus.NOT_FOUND);
	});
});
