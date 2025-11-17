import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { Queue } from 'bullmq';
import { expect } from 'chai';
import { Redis } from 'ioredis';
import { randomUUID } from 'node:crypto';
import { createTestAdmin, createTestUser } from '../../../../test/fixtures/user.fixture';
import { createTestVideoRecord } from '../../../../test/fixtures/video-db.fixture';
import { ISharedContext } from '../../../../test/setup/test.app-setup';
import { TestHttpClient } from '../../../../test/test.http-client';
import { jwtConfig } from '../../../config';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { REDIS_CONNECTION_KEY } from '../../../infra/redis.const';
import { VM_ORCHESTRATOR_ADAPTER, VmOrchestratorAdapter } from '../../ports/vm-orchestrator.adapter';
import { InterviewTranscriptionsTestRepository } from '../../test-utils/test.repo';
import { InterviewTranscriptionsTestSdk } from '../../test-utils/test.sdk';
import { UsersTestRepository } from '../../../user/test-utils/test.repo';
import { VideosTestRepository } from '../../../video/test-utils/test.repo';

describe('[E2E] Start interview transcription usecase', () => {
	let app: INestApplication;
	let usersRepo: UsersTestRepository;
	let videosRepo: VideosTestRepository;
	let transcriptionsRepo: InterviewTranscriptionsTestRepository;
	let sdk: InterviewTranscriptionsTestSdk;
	let vmAdapter: VmOrchestratorAdapter;
	let queue: Queue;

	before(function (this: ISharedContext) {
		app = this.app;
		const db = app.get(DatabaseProvider);
		usersRepo = new UsersTestRepository(db);
		videosRepo = new VideosTestRepository(db);
		transcriptionsRepo = new InterviewTranscriptionsTestRepository(db);
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
		expect(job?.data).to.include({ storageKey: video.storage_key, videoId: video.id });

		const vmStatus = await vmAdapter.getVmStatus();
		expect(vmStatus.powerState).to.equal('running');
	});

	it('does not queue up transcription twice for one video', async () => {
		const owner = await createTestUser(usersRepo);
		const video = await createTestVideoRecord(videosRepo, owner.id);

		const firstRes = await sdk.startTranscription({
			params: { video_id: video.id },
			userMeta: {
				isAuth: true,
				isWrongAccessJwt: false,
				userId: owner.id,
			},
		});

		expect(firstRes.status).to.equal(HttpStatus.CREATED);
		if (firstRes.status !== HttpStatus.CREATED) {
			throw new Error('Failed to start transcription');
		}

		expect(await queue.getWaitingCount()).to.equal(1);

		const secondRes = await sdk.startTranscription({
			params: { video_id: video.id },
			userMeta: {
				isAuth: true,
				isWrongAccessJwt: false,
				userId: owner.id,
			},
		});

		expect(secondRes.status).to.equal(HttpStatus.CREATED);
		if (secondRes.status !== HttpStatus.CREATED) {
			throw new Error('Second request failed');
		}

		expect(secondRes.body.id).to.equal(firstRes.body.id);
		expect(await queue.getWaitingCount()).to.equal(1);
		expect(await transcriptionsRepo.countByStatus('processing')).to.equal(1);
	});
});
