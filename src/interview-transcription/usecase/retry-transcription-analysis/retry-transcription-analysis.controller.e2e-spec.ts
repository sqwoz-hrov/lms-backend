import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { Queue } from 'bullmq';
import { expect } from 'chai';
import { Redis } from 'ioredis';
import { randomUUID } from 'node:crypto';
import { createTestAdmin, createTestUser } from '../../../../test/fixtures/user.fixture';
import { createTestVideoRecord } from '../../../../test/fixtures/video-db.fixture';
import { createTestInterviewTranscription } from '../../../../test/fixtures/interview-transcription.fixture';
import { ISharedContext } from '../../../../test/setup/test.app-setup';
import { TestHttpClient } from '../../../../test/test.http-client';
import { jwtConfig } from '../../../config';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { REDIS_CONNECTION_KEY } from '../../../infra/redis.const';
import { VM_ORCHESTRATOR_ADAPTER, VmOrchestratorAdapter } from '../../ports/vm-orchestrator.adapter';
import { InterviewTranscriptionsTestRepository } from '../../test-utils/test.repo';
import { UsersTestRepository } from '../../../user/test-utils/test.repo';
import { VideosTestRepository } from '../../../video/test-utils/test.repo';
import { InterviewTranscriptionsTestSdk } from '../../test-utils/test.sdk';

describe('[E2E] Retry transcription analysis usecase', () => {
	let app: INestApplication;
	let usersRepo: UsersTestRepository;
	let videosRepo: VideosTestRepository;
	let transcriptionsRepo: InterviewTranscriptionsTestRepository;
	let sdk: InterviewTranscriptionsTestSdk;
	let queue: Queue;
	let vmAdapter: VmOrchestratorAdapter;

	before(function (this: ISharedContext) {
		app = this.app;
		const db = app.get(DatabaseProvider);
		usersRepo = new UsersTestRepository(db);
		videosRepo = new VideosTestRepository(db);
		transcriptionsRepo = new InterviewTranscriptionsTestRepository(db);
		vmAdapter = app.get<VmOrchestratorAdapter>(VM_ORCHESTRATOR_ADAPTER);
		sdk = new InterviewTranscriptionsTestSdk(
			new TestHttpClient(
				{ host: 'http://127.0.0.1', port: 3000 },
				app.get<ConfigType<typeof jwtConfig>>(jwtConfig.KEY),
			),
		);
		const redisConnection = app.get<Redis>(REDIS_CONNECTION_KEY);
		queue = new Queue('interview-transcription', {
			connection: redisConnection,
			skipWaitingForReady: true,
		});
	});

	afterEach(async () => {
		await transcriptionsRepo.clearAll();
		await videosRepo.clearAll();
		await usersRepo.clearAll();
		await queue.drain(true);
		await vmAdapter.stopVm();
	});

	after(async () => {
		await queue?.close();
	});

	it('rejects unauthenticated calls', async () => {
		const res = await sdk.retryAnalysis({
			params: { transcription_id: randomUUID() },
			userMeta: { isAuth: false },
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('returns 400 when transcription is not finished', async () => {
		const owner = await createTestUser(usersRepo);
		const video = await createTestVideoRecord(videosRepo, owner.id);
		const transcription = await createTestInterviewTranscription(transcriptionsRepo, video.id, {
			status: 'processing',
		});

		const res = await sdk.retryAnalysis({
			params: { transcription_id: transcription.id },
			userMeta: { isAuth: true, isWrongAccessJwt: false, userId: owner.id },
		});

		expect(res.status).to.equal(HttpStatus.BAD_REQUEST);
	});

	it('returns 400 when transcription is "failed" (well, retrying) and does not enqueue analysis retry', async () => {
		const owner = await createTestUser(usersRepo);
		const video = await createTestVideoRecord(videosRepo, owner.id);
		const transcription = await createTestInterviewTranscription(transcriptionsRepo, video.id, {
			status: 'restarted',
		});

		const res = await sdk.retryAnalysis({
			params: { transcription_id: transcription.id },
			userMeta: { isAuth: true, isWrongAccessJwt: false, userId: owner.id },
		});

		expect(res.status).to.equal(HttpStatus.BAD_REQUEST);

		const waitingJobs = await queue.getJobs(['waiting']);
		expect(waitingJobs).to.have.length(0);
	});

	it('rejects restart analysis when transcription audio file is missing on video', async () => {
		const owner = await createTestUser(usersRepo);
		const video = await createTestVideoRecord(videosRepo, owner.id, {
			transcription_audio_storage_key: null,
		});
		const transcription = await createTestInterviewTranscription(transcriptionsRepo, video.id);

		const res = await sdk.retryAnalysis({
			params: { transcription_id: transcription.id },
			userMeta: { isAuth: true, isWrongAccessJwt: false, userId: owner.id },
		});

		expect(res.status).to.equal(HttpStatus.BAD_REQUEST);
	});

	it('allows owner to retry analysis only and enqueues analysisOnly job without status reset', async () => {
		const owner = await createTestUser(usersRepo);
		const video = await createTestVideoRecord(videosRepo, owner.id);
		const transcription = await createTestInterviewTranscription(transcriptionsRepo, video.id, {
			s3_transcription_key: 'transcriptions/existing.json',
			status: 'done',
		});

		const res = await sdk.retryAnalysis({
			params: { transcription_id: transcription.id },
			userMeta: { isAuth: true, isWrongAccessJwt: false, userId: owner.id },
		});

		expect(res.status).to.equal(HttpStatus.OK);
		if (res.status !== HttpStatus.OK) throw new Error('Retry analysis failed');

		const stored = await transcriptionsRepo.findById(transcription.id);
		expect(stored?.status).to.equal('done');
		expect(stored?.s3_transcription_key).to.equal('transcriptions/existing.json');

		const [job] = await queue.getJobs(['waiting']);
		expect(job?.data).to.include({
			videoId: video.id,
			interviewTranscriptionId: transcription.id,
			forceRestart: true,
			audioStorageKey: video.transcription_audio_storage_key,
			startFrom: 'analysis',
		});
		expect(job?.data.forceRestart).to.equal(true);
		expect(job?.data).to.not.have.property('storageKey');

		const vmStatus = await vmAdapter.getVmStatus();
		expect(vmStatus.powerState).to.equal('running');
	});

	it('rejects retry analysis from a different non-admin user', async () => {
		const owner = await createTestUser(usersRepo);
		const otherUser = await createTestUser(usersRepo);
		const video = await createTestVideoRecord(videosRepo, owner.id);
		const transcription = await createTestInterviewTranscription(transcriptionsRepo, video.id, {
			s3_transcription_key: 'transcriptions/existing.json',
			status: 'done',
		});

		const res = await sdk.retryAnalysis({
			params: { transcription_id: transcription.id },
			userMeta: { isAuth: true, isWrongAccessJwt: false, userId: otherUser.id },
		});

		expect(res.status).to.equal(HttpStatus.FORBIDDEN);

		const waitingJobs = await queue.getJobs(['waiting']);
		expect(waitingJobs).to.have.length(0);
	});

	it('allows admin to retry analysis for another user', async () => {
		const admin = await createTestAdmin(usersRepo);
		const owner = await createTestUser(usersRepo);
		const video = await createTestVideoRecord(videosRepo, owner.id);
		const transcription = await createTestInterviewTranscription(transcriptionsRepo, video.id, {
			s3_transcription_key: 'transcriptions/existing.json',
			status: 'done',
		});

		const res = await sdk.retryAnalysis({
			params: { transcription_id: transcription.id },
			userMeta: { isAuth: true, isWrongAccessJwt: false, userId: admin.id },
		});

		expect(res.status).to.equal(HttpStatus.OK);

		const stored = await transcriptionsRepo.findById(transcription.id);
		expect(stored?.status).to.equal('done');
		expect(stored?.s3_transcription_key).to.equal('transcriptions/existing.json');

		const [job] = await queue.getJobs(['waiting']);
		expect(job?.data.forceRestart).to.equal(true);
		expect(job?.data).to.not.have.property('storageKey');

		const vmStatus = await vmAdapter.getVmStatus();
		expect(vmStatus.powerState).to.equal('running');
	});
});
