import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { expect } from 'chai';
import { createTestFeedbackDto } from '../../../../test/fixtures/feedback.fixture';
import { InterviewAggregateBuilder } from '../../../../test/fixtures/interview.fixture';
import { createTestAdmin, createTestUser } from '../../../../test/fixtures/user.fixture';
import { ISharedContext } from '../../../../test/setup/test.app-setup';
import { TestHttpClient } from '../../../../test/test.http-client';
import { jwtConfig } from '../../../config';
import { HrConnectionsTestRepository } from '../../../hr-connection/test-utils/test.repo';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { InterviewsTestRepository } from '../../../interview/test-utils/test.repo';
import { UsersTestRepository } from '../../../user/test-utils/test.repo';
import { FeedbacksTestRepository } from '../../test-utils/test.repo';
import { FeedbackTestSdk } from '../../test-utils/test.sdk';

describe('[E2E] Create Feedback usecase', () => {
	let app: INestApplication;

	let userUtilRepo: UsersTestRepository;
	let hrUtilRepo: HrConnectionsTestRepository;
	let interviewUtilRepo: InterviewsTestRepository;
	let feedbackUtilRepo: FeedbacksTestRepository;

	let feedbackSdk: FeedbackTestSdk;

	let interviewBuilder: InterviewAggregateBuilder;

	before(function (this: ISharedContext) {
		app = this.app;
		const kysely = app.get(DatabaseProvider);

		userUtilRepo = new UsersTestRepository(kysely);
		hrUtilRepo = new HrConnectionsTestRepository(kysely);
		interviewUtilRepo = new InterviewsTestRepository(kysely);
		feedbackUtilRepo = new FeedbacksTestRepository(kysely);

		feedbackSdk = new FeedbackTestSdk(
			new TestHttpClient(
				{ port: 3000, host: 'http://127.0.0.1' },
				app.get<ConfigType<typeof jwtConfig>>(jwtConfig.KEY),
			),
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

		const dto = createTestFeedbackDto(interview.id);

		const res = await feedbackSdk.createFeedback({
			params: dto,
			userMeta: { isAuth: false },
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Fake jwt gets 401', async () => {
		const user = await createTestUser(userUtilRepo);
		const interview = await interviewBuilder.createInterview({
			hrConnection: { student_user_id: user.id },
		});

		const dto = createTestFeedbackDto(interview.id);

		const res = await feedbackSdk.createFeedback({
			params: dto,
			userMeta: { userId: user.id, isAuth: true, isWrongAccessJwt: true },
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Non-admin gets 401', async () => {
		const user = await createTestUser(userUtilRepo);
		const interview = await interviewBuilder.createInterview({
			hrConnection: { student_user_id: user.id },
		});

		const dto = createTestFeedbackDto(interview.id);

		const res = await feedbackSdk.createFeedback({
			params: dto,
			userMeta: { userId: user.id, isAuth: true, isWrongAccessJwt: false },
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Admin can create feedback', async () => {
		const admin = await createTestAdmin(userUtilRepo);
		const user = await createTestUser(userUtilRepo);
		const interview = await interviewBuilder.createInterview({
			hrConnection: { student_user_id: user.id },
		});

		const markdownContent = '# Feedback summary';

		const dto = createTestFeedbackDto(interview.id, {
			markdown_content: markdownContent,
		});

		const res = await feedbackSdk.createFeedback({
			params: dto,
			userMeta: { userId: admin.id, isAuth: true, isWrongAccessJwt: false },
		});

		expect(res.status).to.equal(HttpStatus.CREATED);
		if (res.status != 201) throw new Error();
		expect(res.body.interview_id).to.equal(interview.id);
		expect(res.body.markdown_content).to.equal(markdownContent);
	});
});
