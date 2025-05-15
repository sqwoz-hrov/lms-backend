import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { expect } from 'chai';
import { createTestFeedbackDto } from '../../../../test/fixtures/feedback.fixture';
import { InterviewAggregateBuilder } from '../../../../test/fixtures/interview.fixture';
import { createTestMarkdownContent } from '../../../../test/fixtures/markdown-content.fixture';
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

describe('[E2E] Create Feedback usecase', () => {
	let app: INestApplication;

	let userUtilRepo: UsersTestRepository;
	let hrUtilRepo: HrConnectionsTestRepository;
	let interviewUtilRepo: InterviewsTestRepository;
	let markdownContentUtilRepo: MarkDownContentTestRepository;
	let feedbackUtilRepo: FeedbacksTestRepository;

	let feedbackSdk: FeedbackTestSdk;

	let interviewBuilder: InterviewAggregateBuilder;

	before(function (this: ISharedContext) {
		app = this.app;
		const kysely = app.get(DatabaseProvider);

		userUtilRepo = new UsersTestRepository(kysely);
		hrUtilRepo = new HrConnectionsTestRepository(kysely);
		interviewUtilRepo = new InterviewsTestRepository(kysely);
		markdownContentUtilRepo = new MarkDownContentTestRepository(kysely);
		feedbackUtilRepo = new FeedbacksTestRepository(kysely);

		feedbackSdk = new FeedbackTestSdk(
			new TestHttpClient({ port: 3000, host: 'http://127.0.0.1' }),
			app.get<ConfigType<typeof jwtConfig>>(jwtConfig.KEY),
		);

		interviewBuilder = new InterviewAggregateBuilder(userUtilRepo, hrUtilRepo, interviewUtilRepo);
	});

	afterEach(async () => {
		await feedbackUtilRepo.clearAll();
		await interviewUtilRepo.clearAll();
		await hrUtilRepo.clearAll();
		await userUtilRepo.clearAll();
	});

	it('Unauthenticated gets 401', async () => {
		const user = await createTestUser(userUtilRepo);
		const interview = await interviewBuilder.createInterview({
			hrConnection: { student_user_id: user.id },
		});
		const markdown = await createTestMarkdownContent(markdownContentUtilRepo);

		const dto = createTestFeedbackDto(interview.id, markdown.id);

		const res = await feedbackSdk.createFeedback({
			params: dto,
			userMeta: { userId: user.id, isAuth: false, isWrongJwt: false },
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Fake jwt gets 401', async () => {
		const user = await createTestUser(userUtilRepo);
		const interview = await interviewBuilder.createInterview({
			hrConnection: { student_user_id: user.id },
		});
		const markdown = await createTestMarkdownContent(markdownContentUtilRepo);

		const dto = createTestFeedbackDto(interview.id, markdown.id);

		const res = await feedbackSdk.createFeedback({
			params: dto,
			userMeta: { userId: user.id, isAuth: true, isWrongJwt: true },
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Non-admin gets 401', async () => {
		const user = await createTestUser(userUtilRepo);
		const interview = await interviewBuilder.createInterview({
			hrConnection: { student_user_id: user.id },
		});
		const markdown = await createTestMarkdownContent(markdownContentUtilRepo);

		const dto = createTestFeedbackDto(interview.id, markdown.id);

		const res = await feedbackSdk.createFeedback({
			params: dto,
			userMeta: { userId: user.id, isAuth: true, isWrongJwt: false },
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Admin can create feedback', async () => {
		const admin = await createTestAdmin(userUtilRepo);
		const user = await createTestUser(userUtilRepo);
		const interview = await interviewBuilder.createInterview({
			hrConnection: { student_user_id: user.id },
		});
		const markdown = await createTestMarkdownContent(markdownContentUtilRepo);

		const dto = createTestFeedbackDto(interview.id, markdown.id, {
			markdown_content: markdown.content_text,
		});

		const res = await feedbackSdk.createFeedback({
			params: dto,
			userMeta: { userId: admin.id, isAuth: true, isWrongJwt: false },
		});

		expect(res.status).to.equal(HttpStatus.CREATED);
		expect(res.body.interview_id).to.equal(interview.id);
		expect(res.body.markdown_content).to.equal(markdown.content_text);
	});
});
