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

describe('[E2E] Get interview transcription by video id usecase', () => {
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
		const res = await sdk.getTranscriptionByVideoId({
			params: { video_id: '00000000-0000-0000-0000-000000000000' },
			userMeta: { isAuth: false },
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('returns 404 when video does not exist', async () => {
		const user = await createTestUser(usersRepo);

		const res = await sdk.getTranscriptionByVideoId({
			params: { video_id: user.id },
			userMeta: { isAuth: true, isWrongAccessJwt: false, userId: user.id },
		});

		expect(res.status).to.equal(HttpStatus.NOT_FOUND);
	});

	it('returns 403 when accessing someone else video', async () => {
		const owner = await createTestUser(usersRepo);
		const intruder = await createTestUser(usersRepo);
		const video = await createTestVideoRecord(videosRepo, owner.id);

		const res = await sdk.getTranscriptionByVideoId({
			params: { video_id: video.id },
			userMeta: { isAuth: true, isWrongAccessJwt: false, userId: intruder.id },
		});

		expect(res.status).to.equal(HttpStatus.FORBIDDEN);
	});

	it('returns 404 when transcription does not exist', async () => {
		const owner = await createTestUser(usersRepo);
		const video = await createTestVideoRecord(videosRepo, owner.id);

		const res = await sdk.getTranscriptionByVideoId({
			params: { video_id: video.id },
			userMeta: { isAuth: true, isWrongAccessJwt: false, userId: owner.id },
		});

		expect(res.status).to.equal(HttpStatus.NOT_FOUND);
	});

	it(`returns transcription for a video if user is it's owner`, async () => {
		const owner = await createTestUser(usersRepo);
		const video = await createTestVideoRecord(videosRepo, owner.id);

		const transcription = await createTestInterviewTranscription(transcriptionsRepo, video.id, {
			s3_transcription_key: 'transcriptions/a.json',
		});

		const res = await sdk.getTranscriptionByVideoId({
			params: { video_id: video.id },
			userMeta: { isAuth: true, isWrongAccessJwt: false, userId: owner.id },
		});

		expect(res.status).to.equal(HttpStatus.OK);
		if (res.status !== HttpStatus.OK) throw new Error('Failed to get transcription');

		expect(res.body.id).to.equal(transcription.id);
		expect(res.body.video_id).to.equal(video.id);
		expect(res.body.transcription_url).to.be.a('string');
	});

	it('allows admins to access any transcription', async () => {
		const admin = await createTestAdmin(usersRepo);
		const owner = await createTestUser(usersRepo);
		const video = await createTestVideoRecord(videosRepo, owner.id);

		await createTestInterviewTranscription(transcriptionsRepo, video.id, {
			status: 'processing',
			s3_transcription_key: null,
		});

		const res = await sdk.getTranscriptionByVideoId({
			params: { video_id: video.id },
			userMeta: { isAuth: true, isWrongAccessJwt: false, userId: admin.id },
		});

		expect(res.status).to.equal(HttpStatus.OK);
		if (res.status !== HttpStatus.OK) throw new Error('Admin request failed');
		expect(res.body.transcription_url).to.equal(undefined);
	});
});
