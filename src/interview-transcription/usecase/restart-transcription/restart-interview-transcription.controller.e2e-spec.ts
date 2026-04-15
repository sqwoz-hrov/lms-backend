import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { Queue } from 'bullmq';
import { expect } from 'chai';
import { Redis } from 'ioredis';
import { randomUUID } from 'node:crypto';
import { createTestAdmin, createTestSubscriber, createTestSubscriptionTier, createTestUser } from '../../../../test/fixtures/user.fixture';
import { createTestVideoRecord } from '../../../../test/fixtures/video-db.fixture';
import { createTestInterviewTranscription } from '../../../../test/fixtures/interview-transcription.fixture';
import { createLimitsFixture } from '../../../../test/fixtures/limits.fixture';
import { ISharedContext } from '../../../../test/setup/test.app-setup';
import { TestHttpClient } from '../../../../test/test.http-client';
import { aiUsageLimitsConfig, jwtConfig } from '../../../config';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { REDIS_CONNECTION_KEY } from '../../../infra/redis.const';
import { VM_ORCHESTRATOR_ADAPTER, VmOrchestratorAdapter } from '../../ports/vm-orchestrator.adapter';
import { InterviewTranscriptionsTestRepository } from '../../test-utils/test.repo';
import { InterviewTranscriptionsTestSdk } from '../../test-utils/test.sdk';
import { UsersTestRepository } from '../../../user/test-utils/test.repo';
import { VideosTestRepository } from '../../../video/test-utils/test.repo';

describe('[E2E] Restart interview transcription usecase', () => {
	let app: INestApplication;
	let usersRepo: UsersTestRepository;
	let videosRepo: VideosTestRepository;
	let transcriptionsRepo: InterviewTranscriptionsTestRepository;
	let sdk: InterviewTranscriptionsTestSdk;
	let queue: Queue;
	let vmAdapter: VmOrchestratorAdapter;
	let limitsFixture: ReturnType<typeof createLimitsFixture>;
	let limitsConfig: ConfigType<typeof aiUsageLimitsConfig>;

	before(function (this: ISharedContext) {
		app = this.app;
		const db = app.get(DatabaseProvider);
		usersRepo = new UsersTestRepository(db);
		videosRepo = new VideosTestRepository(db);
		transcriptionsRepo = new InterviewTranscriptionsTestRepository(db);
		limitsFixture = createLimitsFixture(db);
		limitsConfig = app.get<ConfigType<typeof aiUsageLimitsConfig>>(aiUsageLimitsConfig.KEY);
		vmAdapter = app.get<VmOrchestratorAdapter>(VM_ORCHESTRATOR_ADAPTER);
		sdk = new InterviewTranscriptionsTestSdk(
			new TestHttpClient(
				{
					host: 'http://127.0.0.1',
					port: 3000,
				},
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
		const res = await sdk.restartTranscription({
			params: { interview_transcription_id: randomUUID() },
			userMeta: { isAuth: false },
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('returns 404 when transcription does not exist', async () => {
		const user = await createTestUser(usersRepo);

		const res = await sdk.restartTranscription({
			params: { interview_transcription_id: randomUUID() },
			userMeta: {
				isAuth: true,
				isWrongAccessJwt: false,
				userId: user.id,
			},
		});

		expect(res.status).to.equal(HttpStatus.NOT_FOUND);
	});

	it('prevents restarting transcription owned by another user', async () => {
		const owner = await createTestUser(usersRepo);
		const intruder = await createTestUser(usersRepo);
		const video = await createTestVideoRecord(videosRepo, owner.id);
		const transcription = await createTestInterviewTranscription(transcriptionsRepo, video.id);

		const res = await sdk.restartTranscription({
			params: { interview_transcription_id: transcription.id },
			userMeta: {
				isAuth: true,
				isWrongAccessJwt: false,
				userId: intruder.id,
			},
		});

		expect(res.status).to.equal(HttpStatus.FORBIDDEN);
	});

	it('restarts finished transcription for owner, clears stored key and enqueues job', async () => {
		const owner = await createTestUser(usersRepo);
		const video = await createTestVideoRecord(videosRepo, owner.id);
		const transcription = await createTestInterviewTranscription(transcriptionsRepo, video.id, {
			s3_transcription_key: 'transcriptions/previous.json',
		});

		const res = await sdk.restartTranscription({
			params: { interview_transcription_id: transcription.id },
			userMeta: {
				isAuth: true,
				isWrongAccessJwt: false,
				userId: owner.id,
			},
		});

		expect(res.status).to.equal(HttpStatus.OK);
		if (res.status !== HttpStatus.OK) throw new Error('Failed to restart transcription');

		expect(res.body.id).to.equal(transcription.id);
		expect(res.body.video_id).to.equal(video.id);
		expect(res.body.status).to.equal('processing');
		expect(res.body.s3_transcription_key).to.equal(null);

		const stored = await transcriptionsRepo.findById(transcription.id);
		expect(stored?.status).to.equal('processing');
		expect(stored?.s3_transcription_key).to.equal(null);

		const [job] = await queue.getJobs(['waiting']);
		expect(job?.data).to.include({
			audioStorageKey: video.transcription_audio_storage_key,
			videoId: video.id,
			interviewTranscriptionId: transcription.id,
		});
		expect(job?.data.forceRestart).to.equal(true);
		expect(job?.data).to.not.have.property('storageKey');

		const vmStatus = await vmAdapter.getVmStatus();
		expect(vmStatus.powerState).to.equal('running');
	});

	it('allows admins to restart transcriptions they do not own', async () => {
		const admin = await createTestAdmin(usersRepo);
		const owner = await createTestUser(usersRepo);
		const video = await createTestVideoRecord(videosRepo, owner.id);
		const transcription = await createTestInterviewTranscription(transcriptionsRepo, video.id);

		const res = await sdk.restartTranscription({
			params: { interview_transcription_id: transcription.id },
			userMeta: {
				isAuth: true,
				isWrongAccessJwt: false,
				userId: admin.id,
			},
		});

		expect(res.status).to.equal(HttpStatus.OK);
		if (res.status !== HttpStatus.OK) {
			throw new Error('Admin request failed');
		}
		expect(res.body.id).to.equal(transcription.id);
	});

	it('rejects restart when transcription audio file is missing on video', async () => {
		const owner = await createTestUser(usersRepo);
		const video = await createTestVideoRecord(videosRepo, owner.id, {
			transcription_audio_storage_key: null,
		});
		const transcription = await createTestInterviewTranscription(transcriptionsRepo, video.id);

		const res = await sdk.restartTranscription({
			params: { interview_transcription_id: transcription.id },
			userMeta: {
				isAuth: true,
				isWrongAccessJwt: false,
				userId: owner.id,
			},
		});

		expect(res.status).to.equal(HttpStatus.BAD_REQUEST);
	});

	for (const initialStatus of ['created', 'processing', 'restarted'] as const) {
		it(`rejects restart when transcription is in ${initialStatus} status`, async () => {
			const owner = await createTestUser(usersRepo);
			const video = await createTestVideoRecord(videosRepo, owner.id);
			const transcription = await createTestInterviewTranscription(transcriptionsRepo, video.id, {
				status: initialStatus,
			});

			const res = await sdk.restartTranscription({
				params: { interview_transcription_id: transcription.id },
				userMeta: {
					isAuth: true,
					isWrongAccessJwt: false,
					userId: owner.id,
				},
			});

			if (res.status !== HttpStatus.BAD_REQUEST) {
				throw new Error(`Expected 400 Bad Request when restarting transcription in ${initialStatus} status`);
			}

			expect(res.status).to.equal(HttpStatus.BAD_REQUEST);
			expect(res.body.description).to.equal('Транскрибацию можно перезапустить только после её завершения');
		});
	}

	it('returns 429 when free-tier subscriber exceeds AI usage limit and keeps usage records capped at limit', async () => {
		const threshold = Math.max(limitsConfig.interviewTranscriptionDaily, limitsConfig.interviewTranscriptionHourly);
		const attempts = threshold + 1;

		const freeTier = await createTestSubscriptionTier(usersRepo, {
			power: 0,
			price_rubles: 0,
			tier: 'free',
		});
		const owner = await createTestSubscriber(usersRepo, {
			subscription_tier_id: freeTier.id,
			is_billable: false,
		});

		const videos = await Promise.all(
			Array.from({ length: attempts }, () => createTestVideoRecord(videosRepo, owner.id)),
		);

		const transcriptions = await Promise.all(
			videos.map(video => createTestInterviewTranscription(transcriptionsRepo, video.id, { status: 'done' })),
		);

		for (const transcription of transcriptions.slice(0, threshold)) {
			const res = await sdk.restartTranscription({
				params: { interview_transcription_id: transcription.id },
				userMeta: {
					isAuth: true,
					isWrongAccessJwt: false,
					userId: owner.id,
				},
			});

			expect(res.status).to.equal(HttpStatus.OK);
		}

		const exceededRes = await sdk.restartTranscription({
			params: { interview_transcription_id: transcriptions[threshold].id },
			userMeta: {
				isAuth: true,
				isWrongAccessJwt: false,
				userId: owner.id,
			},
		});

		expect(exceededRes.status).to.equal(429);
		const exceededBody = exceededRes.body as { description: string };
		expect(exceededBody.description).to.contain('AI usage limit exceeded');
		expect(exceededBody.description).to.contain(
			`interview_transcription_daily_${limitsConfig.interviewTranscriptionDaily}`,
		);
		expect(exceededBody.description).to.contain(
			`interview_transcription_hourly_${limitsConfig.interviewTranscriptionHourly}`,
		);

		const usageCount = await limitsFixture.countUsageRecords({ userId: owner.id });

		expect(usageCount).to.equal(threshold);
	});
});
