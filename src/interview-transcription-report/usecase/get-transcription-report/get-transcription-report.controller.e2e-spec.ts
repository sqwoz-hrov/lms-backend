import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { expect } from 'chai';
import { createTestAdmin, createTestSubscriber, createTestUser } from '../../../../test/fixtures/user.fixture';
import { createTestVideoRecord } from '../../../../test/fixtures/video-db.fixture';
import { createTestInterviewTranscription } from '../../../../test/fixtures/interview-transcription.fixture';
import { ISharedContext } from '../../../../test/setup/test.app-setup';
import { TestHttpClient } from '../../../../test/test.http-client';
import { jwtConfig } from '../../../config';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { InterviewTranscriptionsTestRepository } from '../../../interview-transcription/test-utils/test.repo';
import { UsersTestRepository } from '../../../user/test-utils/test.repo';
import { VideosTestRepository } from '../../../video/test-utils/test.repo';
import { InterviewTranscriptionReportTestRepository } from '../../test-utils/test.repo';
import { InterviewTranscriptionReportTestSdk } from '../../test-utils/test.sdk';

const VALID_REPORT = {
	llm_report_parsed: [
		{
			hintType: 'praise' as const,
			lineId: 1,
			topic: 'Code structure',
			praise: 'Clean separation of concerns',
		},
	],
	candidate_name_in_transcription: 'SPEAKER_01',
	candidate_name: 'Test Candidate',
};

describe('[E2E] Get transcription report usecase', () => {
	let app: INestApplication;
	let usersRepo: UsersTestRepository;
	let videosRepo: VideosTestRepository;
	let transcriptionsRepo: InterviewTranscriptionsTestRepository;
	let reportsRepo: InterviewTranscriptionReportTestRepository;
	let sdk: InterviewTranscriptionReportTestSdk;

	before(function (this: ISharedContext) {
		app = this.app;
		const db = app.get(DatabaseProvider);
		usersRepo = new UsersTestRepository(db);
		videosRepo = new VideosTestRepository(db);
		transcriptionsRepo = new InterviewTranscriptionsTestRepository(db);
		reportsRepo = new InterviewTranscriptionReportTestRepository(db);
		sdk = new InterviewTranscriptionReportTestSdk(
			new TestHttpClient(
				{ host: 'http://127.0.0.1', port: 3000 },
				app.get<ConfigType<typeof jwtConfig>>(jwtConfig.KEY),
			),
		);
	});

	afterEach(async () => {
		await reportsRepo.clearAll();
		await transcriptionsRepo.clearAll();
		await videosRepo.clearAll();
		await usersRepo.clearAll();
	});

	it('rejects unauthenticated calls', async () => {
		const res = await sdk.getReport({
			params: { transcription_id: '00000000-0000-0000-0000-000000000000' },
			userMeta: { isAuth: false },
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('returns 404 when transcription does not exist', async () => {
		const user = await createTestUser(usersRepo);

		const res = await sdk.getReport({
			params: { transcription_id: '00000000-0000-0000-0000-000000000000' },
			userMeta: { isAuth: true, isWrongAccessJwt: false, userId: user.id },
		});

		expect(res.status).to.equal(HttpStatus.NOT_FOUND);
	});

	it('returns 404 when transcription exists but report does not', async () => {
		const owner = await createTestUser(usersRepo);
		const video = await createTestVideoRecord(videosRepo, owner.id);
		const transcription = await createTestInterviewTranscription(transcriptionsRepo, video.id);

		const res = await sdk.getReport({
			params: { transcription_id: transcription.id },
			userMeta: { isAuth: true, isWrongAccessJwt: false, userId: owner.id },
		});

		expect(res.status).to.equal(HttpStatus.NOT_FOUND);
	});

	it('returns 403 when a regular user tries to get someone else\'s report', async () => {
		const owner = await createTestUser(usersRepo);
		const intruder = await createTestUser(usersRepo);
		const video = await createTestVideoRecord(videosRepo, owner.id);
		const transcription = await createTestInterviewTranscription(transcriptionsRepo, video.id);
		await reportsRepo.insertRaw({ interview_transcription_id: transcription.id, ...VALID_REPORT });

		const res = await sdk.getReport({
			params: { transcription_id: transcription.id },
			userMeta: { isAuth: true, isWrongAccessJwt: false, userId: intruder.id },
		});

		expect(res.status).to.equal(HttpStatus.FORBIDDEN);
	});

	it('returns 403 when a subscriber tries to get someone else\'s report', async () => {
		const owner = await createTestUser(usersRepo);
		const subscriber = await createTestSubscriber(usersRepo);
		const video = await createTestVideoRecord(videosRepo, owner.id);
		const transcription = await createTestInterviewTranscription(transcriptionsRepo, video.id);
		await reportsRepo.insertRaw({ interview_transcription_id: transcription.id, ...VALID_REPORT });

		const res = await sdk.getReport({
			params: { transcription_id: transcription.id },
			userMeta: { isAuth: true, isWrongAccessJwt: false, userId: subscriber.id },
		});

		expect(res.status).to.equal(HttpStatus.FORBIDDEN);
	});

	for (const role of ['user', 'subscriber', 'admin'] as const) {
		it(`allows a ${role} to get their own transcription report`, async () => {
			const owner =
				role === 'admin'
					? await createTestAdmin(usersRepo)
					: role === 'subscriber'
						? await createTestSubscriber(usersRepo)
						: await createTestUser(usersRepo);

			const video = await createTestVideoRecord(videosRepo, owner.id);
			const transcription = await createTestInterviewTranscription(transcriptionsRepo, video.id);
			const report = await reportsRepo.insertRaw({
				interview_transcription_id: transcription.id,
				...VALID_REPORT,
			});

			const res = await sdk.getReport({
				params: { transcription_id: transcription.id },
				userMeta: { isAuth: true, isWrongAccessJwt: false, userId: owner.id },
			});

			expect(res.status).to.equal(HttpStatus.OK);
			if (res.status !== HttpStatus.OK) throw new Error(`${role} request failed`);
			expect(res.body.id).to.equal(report.id);
			expect(res.body.interview_transcription_id).to.equal(transcription.id);
		});
	}

	it('allows an admin to get any user\'s transcription report', async () => {
		const admin = await createTestAdmin(usersRepo);
		const owner = await createTestUser(usersRepo);
		const video = await createTestVideoRecord(videosRepo, owner.id);
		const transcription = await createTestInterviewTranscription(transcriptionsRepo, video.id);
		const report = await reportsRepo.insertRaw({ interview_transcription_id: transcription.id, ...VALID_REPORT });

		const res = await sdk.getReport({
			params: { transcription_id: transcription.id },
			userMeta: { isAuth: true, isWrongAccessJwt: false, userId: admin.id },
		});

		expect(res.status).to.equal(HttpStatus.OK);
		if (res.status !== HttpStatus.OK) throw new Error('Admin request failed');
		expect(res.body.id).to.equal(report.id);
	});
});
