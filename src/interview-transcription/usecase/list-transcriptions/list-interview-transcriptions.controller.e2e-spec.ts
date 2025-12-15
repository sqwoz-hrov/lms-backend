import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { expect } from 'chai';
import { createTestAdmin, createTestUser } from '../../../../test/fixtures/user.fixture';
import { createTestVideoRecord } from '../../../../test/fixtures/video-db.fixture';
import { createTestInterviewTranscription } from '../../../../test/fixtures/interview-transcription.fixture';
import { ISharedContext } from '../../../../test/setup/test.app-setup';
import { TestHttpClient } from '../../../../test/test.http-client';
import { jwtConfig } from '../../../config';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { InterviewTranscriptionsTestRepository } from '../../test-utils/test.repo';
import { InterviewTranscriptionsTestSdk } from '../../test-utils/test.sdk';
import { UsersTestRepository } from '../../../user/test-utils/test.repo';
import { VideosTestRepository } from '../../../video/test-utils/test.repo';

describe('[E2E] List interview transcriptions usecase', () => {
	let app: INestApplication;
	let usersRepo: UsersTestRepository;
	let videosRepo: VideosTestRepository;
	let transcriptionsRepo: InterviewTranscriptionsTestRepository;
	let sdk: InterviewTranscriptionsTestSdk;

	before(function (this: ISharedContext) {
		app = this.app;
		const db = app.get(DatabaseProvider);
		usersRepo = new UsersTestRepository(db);
		videosRepo = new VideosTestRepository(db);
		transcriptionsRepo = new InterviewTranscriptionsTestRepository(db);
		sdk = new InterviewTranscriptionsTestSdk(
			new TestHttpClient(
				{
					host: 'http://127.0.0.1',
					port: 3000,
				},
				app.get<ConfigType<typeof jwtConfig>>(jwtConfig.KEY),
			),
		);
	});

	afterEach(async () => {
		await transcriptionsRepo.clearAll();
		await videosRepo.clearAll();
		await usersRepo.clearAll();
	});

	it('rejects unauthenticated calls', async () => {
		const res = await sdk.listTranscriptions({
			userMeta: { isAuth: false },
			params: {},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('returns only current user transcriptions', async () => {
		const owner = await createTestUser(usersRepo);
		const otherUser = await createTestUser(usersRepo);
		const videoA = await createTestVideoRecord(videosRepo, owner.id);
		const videoB = await createTestVideoRecord(videosRepo, owner.id);
		const otherVideo = await createTestVideoRecord(videosRepo, otherUser.id);

		await createTestInterviewTranscription(transcriptionsRepo, videoA.id, {
			created_at: new Date('2024-01-01T10:00:00Z'),
			s3_transcription_key: 'transcriptions/a.json',
		});
		await createTestInterviewTranscription(transcriptionsRepo, videoB.id, {
			created_at: new Date('2024-01-01T12:00:00Z'),
			status: 'processing',
			s3_transcription_key: null,
		});
		await createTestInterviewTranscription(transcriptionsRepo, otherVideo.id);

		const res = await sdk.listTranscriptions({
			userMeta: { isAuth: true, isWrongAccessJwt: false, userId: owner.id },
			params: {},
		});

		expect(res.status).to.equal(HttpStatus.OK);
		if (res.status !== HttpStatus.OK) throw new Error('Failed to fetch transcriptions');

		expect(res.body).to.have.lengthOf(2);
		expect(res.body[0].video_id).to.equal(videoB.id);
		expect(res.body[1].video_id).to.equal(videoA.id);
	});

	it('ignores user_id filter for non-admin users', async () => {
		const owner = await createTestUser(usersRepo);
		const otherUser = await createTestUser(usersRepo);
		const video = await createTestVideoRecord(videosRepo, owner.id);
		const otherVideo = await createTestVideoRecord(videosRepo, otherUser.id);
		await createTestInterviewTranscription(transcriptionsRepo, video.id);
		await createTestInterviewTranscription(transcriptionsRepo, otherVideo.id);

		const res = await sdk.listTranscriptions({
			userMeta: { isAuth: true, isWrongAccessJwt: false, userId: owner.id },
			params: { user_id: otherUser.id },
		});

		expect(res.status).to.equal(HttpStatus.OK);
		if (res.status !== HttpStatus.OK) throw new Error('Expected OK response');
		expect(res.body).to.have.lengthOf(1);
		expect(res.body[0].video_id).to.equal(video.id);
	});

	it('allows admin to request transcriptions for specific user', async () => {
		const admin = await createTestAdmin(usersRepo);
		const owner = await createTestUser(usersRepo);
		const video = await createTestVideoRecord(videosRepo, owner.id);
		await createTestInterviewTranscription(transcriptionsRepo, video.id);

		const res = await sdk.listTranscriptions({
			userMeta: { isAuth: true, isWrongAccessJwt: false, userId: admin.id },
			params: { user_id: owner.id },
		});

		expect(res.status).to.equal(HttpStatus.OK);
		if (res.status !== HttpStatus.OK) throw new Error('Admin request failed');

		expect(res.body).to.have.lengthOf(1);
		expect(res.body[0].video_id).to.equal(video.id);
	});
});
