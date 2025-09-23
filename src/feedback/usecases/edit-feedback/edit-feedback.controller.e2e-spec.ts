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

describe('[E2E] Edit Feedback usecase', () => {
	let app: INestApplication;

	let userUtilRepo: UsersTestRepository;
	let hrUtilRepo: HrConnectionsTestRepository;
	let interviewUtilRepo: InterviewsTestRepository;
	let markdownContentUtilRepo: MarkDownContentTestRepository;
	let feedbackUtilRepo: FeedbacksTestRepository;

	let feedbackSdk: FeedbackTestSdk;

	let feedbackAggregateBuilder: FeedbackAggregateBuilder;

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

		feedbackAggregateBuilder = new FeedbackAggregateBuilder(
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
	});

	it('Unauthenticated gets 401', async () => {
		const admin = await createTestAdmin(userUtilRepo);
		const feedback = await feedbackAggregateBuilder.createFeedback({});

		const res = await feedbackSdk.editFeedback({
			params: { id: feedback.id, markdown_content: 'Updated markdown_content' },
			userMeta: { userId: admin.id, isAuth: false, isWrongAccessJwt: false },
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Fake JWT gets 401', async () => {
		const admin = await createTestAdmin(userUtilRepo);
		const feedback = await feedbackAggregateBuilder.createFeedback({});

		const res = await feedbackSdk.editFeedback({
			params: { id: feedback.id, markdown_content: 'Updated markdown_content' },
			userMeta: { userId: admin.id, isAuth: true, isWrongAccessJwt: true },
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Non-admin gets 401', async () => {
		const user = await createTestUser(userUtilRepo);
		const feedback = await feedbackAggregateBuilder.createFeedback({
			hrConnection: { student_user_id: user.id },
		});

		const res = await feedbackSdk.editFeedback({
			params: { id: feedback.id, markdown_content: 'Updated markdown_content' },
			userMeta: { userId: user.id, isAuth: true, isWrongAccessJwt: false },
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Admin can edit feedback', async () => {
		const admin = await createTestAdmin(userUtilRepo);
		const feedback = await feedbackAggregateBuilder.createFeedback({});

		const newContent = 'Updated markdown_content';

		const res = await feedbackSdk.editFeedback({
			params: { id: feedback.id, markdown_content: newContent },
			userMeta: { userId: admin.id, isAuth: true, isWrongAccessJwt: false },
		});

		expect(res.status).to.equal(HttpStatus.OK);
		expect(res.body.markdown_content).to.equal(newContent);
	});

	it('Editing non-existent feedback returns 404', async () => {
		const admin = await createTestAdmin(userUtilRepo);

		const res = await feedbackSdk.editFeedback({
			params: { id: v7(), markdown_content: 'Ghost markdown_content' },
			userMeta: { userId: admin.id, isAuth: true, isWrongAccessJwt: false },
		});

		expect(res.status).to.equal(HttpStatus.NOT_FOUND);
	});
});
