import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { expect } from 'chai';
import { createHmac, randomUUID } from 'node:crypto';
import { createTestUser } from '../../../../test/fixtures/user.fixture';
import { createTestVideoRecord } from '../../../../test/fixtures/video-db.fixture';
import { ISharedContext } from '../../../../test/setup/test.app-setup';
import { TestHttpClient } from '../../../../test/test.http-client';
import { interviewTranscriptionConfig, jwtConfig } from '../../../config';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { VM_ORCHESTRATOR_ADAPTER, VmOrchestratorAdapter } from '../../ports/vm-orchestrator.adapter';
import { InterviewTranscriptionsTestRepository } from '../../test-utils/test.repo';
import { InterviewTranscriptionsTestSdk } from '../../test-utils/test.sdk';
import { UsersTestRepository } from '../../../user/test-utils/test.repo';
import { VideosTestRepository } from '../../../video/test-utils/test.repo';
import { InterviewTranscriptionWebhookDto } from '../../dto/interview-transcription-webhook.dto';

describe('[E2E] Handle transcription finish webhook usecase', () => {
	let app: INestApplication;
	let usersRepo: UsersTestRepository;
	let videosRepo: VideosTestRepository;
	let transcriptionsRepo: InterviewTranscriptionsTestRepository;
	let sdk: InterviewTranscriptionsTestSdk;
	let vmAdapter: VmOrchestratorAdapter;
	let webhookConfig: ConfigType<typeof interviewTranscriptionConfig>;

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
		webhookConfig = app.get<ConfigType<typeof interviewTranscriptionConfig>>(interviewTranscriptionConfig.KEY);
	});

	afterEach(async () => {
		await transcriptionsRepo.clearAll();
		await videosRepo.clearAll();
		await usersRepo.clearAll();
		await vmAdapter.stopVm();
	});

	it('returns 404 when transcription entry is missing', async () => {
		const payload: InterviewTranscriptionWebhookDto = {
			interview_transcription_id: randomUUID(),
			s3_transcription_key: 's3://non-existent',
		};

		const res = await sdk.sendFinishWebhook({
			params: payload,
			userMeta: { isAuth: false },
			headers: buildWebhookHeaders(payload, webhookConfig),
		});

		expect(res.status).to.equal(HttpStatus.NOT_FOUND);
	});

	it('marks transcription done, stores key and powers down VM when processing ends', async () => {
		const owner = await createTestUser(usersRepo);
		const video = await createTestVideoRecord(videosRepo, owner.id);

		const startRes = await sdk.startTranscription({
			params: { video_id: video.id },
			userMeta: {
				isAuth: true,
				isWrongAccessJwt: false,
				userId: owner.id,
			},
		});

		expect(startRes.status).to.equal(HttpStatus.CREATED);
		if (startRes.status !== HttpStatus.CREATED) throw new Error('Failed to start transcription');

		const payload: InterviewTranscriptionWebhookDto = {
			interview_transcription_id: startRes.body.id,
			s3_transcription_key: 'transcriptions/video.json',
		};

		const webhookRes = await sdk.sendFinishWebhook({
			params: payload,
			userMeta: { isAuth: false },
			headers: buildWebhookHeaders(payload, webhookConfig),
		});

		expect(webhookRes.status).to.equal(HttpStatus.OK);
		if (webhookRes.status !== HttpStatus.OK) throw new Error('Webhook request failed');

		expect(webhookRes.body.status).to.equal('done');
		expect(webhookRes.body.s3_transcription_key).to.equal('transcriptions/video.json');

		const stored = await transcriptionsRepo.findById(startRes.body.id);
		expect(stored?.status).to.equal('done');
		expect(stored?.s3_transcription_key).to.equal('transcriptions/video.json');

		const vmStatus = await vmAdapter.getVmStatus();
		expect(vmStatus.powerState).to.equal('stopped');
	});
});

const buildWebhookHeaders = (
	payload: InterviewTranscriptionWebhookDto,
	config: ConfigType<typeof interviewTranscriptionConfig>,
): Record<string, string> | undefined => {
	if (!config.webhookSecret) {
		return undefined;
	}

	const signature = createHmac('sha256', config.webhookSecret).update(JSON.stringify(payload)).digest('hex');
	return {
		[config.webhookSignatureHeader]: signature,
	};
};
