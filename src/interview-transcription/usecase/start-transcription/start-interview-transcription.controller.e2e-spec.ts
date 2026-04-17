import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { Queue } from 'bullmq';
import { expect } from 'chai';
import { Redis } from 'ioredis';
import { randomUUID } from 'node:crypto';
import {
	createTestAdmin,
	createTestSubscriber,
	createTestSubscriptionTier,
	createTestUser,
} from '../../../../test/fixtures/user.fixture';
import { createTestVideoRecord } from '../../../../test/fixtures/video-db.fixture';
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
import { STATUS_VALUES } from '../../interview-transcription.entity';

describe('[E2E] Start interview transcription usecase', () => {
	let app: INestApplication;
	let usersRepo: UsersTestRepository;
	let videosRepo: VideosTestRepository;
	let transcriptionsRepo: InterviewTranscriptionsTestRepository;
	let sdk: InterviewTranscriptionsTestSdk;
	let vmAdapter: VmOrchestratorAdapter;
	let queue: Queue;
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
		const owner = await createTestUser(usersRepo);
		const video = await createTestVideoRecord(videosRepo, owner.id);

		const res = await sdk.startTranscription({
			params: { video_id: video.id },
			userMeta: { isAuth: false },
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('returns 404 when video does not exist', async () => {
		const admin = await createTestAdmin(usersRepo);

		const res = await sdk.startTranscription({
			params: { video_id: randomUUID() },
			userMeta: {
				isAuth: true,
				isWrongAccessJwt: false,
				userId: admin.id,
			},
		});

		expect(res.status).to.equal(HttpStatus.NOT_FOUND);
	});

	it('prevents starting transcription for someone else video', async () => {
		const owner = await createTestUser(usersRepo);
		const intruder = await createTestUser(usersRepo);
		const video = await createTestVideoRecord(videosRepo, owner.id);

		const res = await sdk.startTranscription({
			params: { video_id: video.id },
			userMeta: {
				isAuth: true,
				isWrongAccessJwt: false,
				userId: intruder.id,
			},
		});

		expect(res.status).to.equal(HttpStatus.FORBIDDEN);
	});

	it('rejects unfinished video uploads', async () => {
		const owner = await createTestUser(usersRepo);
		const video = await createTestVideoRecord(videosRepo, owner.id, {
			phase: 'uploading_s3',
			storage_key: null,
		});

		const res = await sdk.startTranscription({
			params: { video_id: video.id },
			userMeta: {
				isAuth: true,
				isWrongAccessJwt: false,
				userId: owner.id,
			},
		});

		expect(res.status).to.equal(HttpStatus.BAD_REQUEST);
	});

	it('rejects video without extracted transcription audio', async () => {
		const owner = await createTestUser(usersRepo);
		const video = await createTestVideoRecord(videosRepo, owner.id, {
			transcription_audio_storage_key: null,
		});

		const res = await sdk.startTranscription({
			params: { video_id: video.id },
			userMeta: {
				isAuth: true,
				isWrongAccessJwt: false,
				userId: owner.id,
			},
		});

		expect(res.status).to.equal(HttpStatus.BAD_REQUEST);
	});

	it('creates transcription record, enqueues job and powers on VM', async () => {
		const owner = await createTestUser(usersRepo);
		const video = await createTestVideoRecord(videosRepo, owner.id);

		const res = await sdk.startTranscription({
			params: { video_id: video.id },
			userMeta: {
				isAuth: true,
				isWrongAccessJwt: false,
				userId: owner.id,
			},
		});

		expect(res.status).to.equal(HttpStatus.CREATED);
		if (res.status !== HttpStatus.CREATED) throw new Error('Request failed');

		expect(res.body.video_id).to.equal(video.id);
		expect(res.body.status).to.equal('processing');
		expect(res.body.s3_transcription_key).to.equal(null);

		const stored = await transcriptionsRepo.findById(res.body.id);
		expect(stored?.status).to.equal('processing');

		const [job] = await queue.getJobs(['waiting']);
		expect(job?.data).to.include({
			audioStorageKey: video.transcription_audio_storage_key,
			videoId: video.id,
		});
		expect(job?.data).to.not.have.property('storageKey');

		const vmStatus = await vmAdapter.getVmStatus();
		expect(vmStatus.powerState).to.equal('running');
	});

	for (const status of STATUS_VALUES) {
		it(`returns 409 when a transcription in status "${status}" already exists for the video`, async () => {
			const owner = await createTestUser(usersRepo);
			const video = await createTestVideoRecord(videosRepo, owner.id);

			await transcriptionsRepo.connection
				.insertInto('interview_transcription')
				.values({ video_id: video.id, status })
				.execute();

			const res = await sdk.startTranscription({
				params: { video_id: video.id },
				userMeta: { isAuth: true, isWrongAccessJwt: false, userId: owner.id },
			});

			expect(res.status).to.equal(HttpStatus.CONFLICT);
			expect(await transcriptionsRepo.countByStatus(status)).to.equal(1);
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

		for (const video of videos.slice(0, threshold)) {
			const res = await sdk.startTranscription({
				params: { video_id: video.id },
				userMeta: {
					isAuth: true,
					isWrongAccessJwt: false,
					userId: owner.id,
				},
			});

			expect(res.status).to.equal(HttpStatus.CREATED);
		}

		const exceededRes = await sdk.startTranscription({
			params: { video_id: videos[threshold].id },
			userMeta: {
				isAuth: true,
				isWrongAccessJwt: false,
				userId: owner.id,
			},
		});

		if (exceededRes.status !== HttpStatus.TOO_MANY_REQUESTS) {
			throw new Error('Expected 429 Too Many Requests when AI usage limit is exceeded');
		}

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
