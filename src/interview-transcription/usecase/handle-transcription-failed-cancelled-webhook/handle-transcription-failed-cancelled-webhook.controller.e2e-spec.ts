import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { expect } from 'chai';
import { createHmac } from 'node:crypto';
import { createTestInterviewTranscription } from '../../../../test/fixtures/interview-transcription.fixture';
import { createTestUser } from '../../../../test/fixtures/user.fixture';
import { createTestVideoRecord } from '../../../../test/fixtures/video-db.fixture';
import { ISharedContext } from '../../../../test/setup/test.app-setup';
import { TestHttpClient } from '../../../../test/test.http-client';
import { interviewTranscriptionConfig, jwtConfig } from '../../../config';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { InterviewTranscriptionsTestRepository } from '../../test-utils/test.repo';
import { InterviewTranscriptionsTestSdk } from '../../test-utils/test.sdk';
import { UsersTestRepository } from '../../../user/test-utils/test.repo';
import { VideosTestRepository } from '../../../video/test-utils/test.repo';
import { InterviewWorkflowFailedCancelledWebhookPayload } from '../../dto/interview-transcription-failed-cancelled-webhook.dto';

describe('[E2E] Handle transcription failed/cancelled webhook usecase', () => {
	let app: INestApplication;
	let usersRepo: UsersTestRepository;
	let videosRepo: VideosTestRepository;
	let transcriptionsRepo: InterviewTranscriptionsTestRepository;
	let sdk: InterviewTranscriptionsTestSdk;
	let webhookConfig: ConfigType<typeof interviewTranscriptionConfig>;

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
		webhookConfig = app.get<ConfigType<typeof interviewTranscriptionConfig>>(interviewTranscriptionConfig.KEY);
	});

	afterEach(async () => {
		await transcriptionsRepo.clearAll();
		await videosRepo.clearAll();
		await usersRepo.clearAll();
	});

	for (const reason of ['cancelled', 'failed'] as const) {
		it(`does not update anything when ${reason} webhook signature is invalid`, async function () {
			if (!webhookConfig.webhookSecret) {
				this.fail();
			}

			const owner = await createTestUser(usersRepo);
			const video = await createTestVideoRecord(videosRepo, owner.id);
			const transcription = await createTestInterviewTranscription(transcriptionsRepo, video.id, {
				status: 'processing',
				s3_transcription_key: null,
			});

			const payload = buildWebhookPayload({
				reason,
				videoId: video.id,
				transcriptionId: transcription.id,
			});

			const res = await sdk.sendFailWebhook({
				params: payload,
				userMeta: { isAuth: false },
				headers: buildWebhookHeaders(payload, { ...webhookConfig, webhookSecret: 'wrong-secret' }),
			});

			expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);

			const stored = await transcriptionsRepo.findById(transcription.id);
			expect(stored?.status).to.equal('processing');
		});

		it(`does not update ${reason} webhook when transcription status is done`, async () => {
			const owner = await createTestUser(usersRepo);
			const video = await createTestVideoRecord(videosRepo, owner.id);
			const transcription = await createTestInterviewTranscription(transcriptionsRepo, video.id, {
				status: 'done',
				s3_transcription_key: 'transcriptions/done.json',
			});

			const payload = buildWebhookPayload({
				reason,
				videoId: video.id,
				transcriptionId: transcription.id,
			});

			const res = await sdk.sendFailWebhook({
				params: payload,
				userMeta: { isAuth: false },
				headers: buildWebhookHeaders(payload, webhookConfig),
			});

			expect(res.status).to.equal(HttpStatus.OK);
			if (res.status !== HttpStatus.OK) throw new Error('Webhook request failed');
			expect(res.body.status).to.equal('done');

			const stored = await transcriptionsRepo.findById(transcription.id);
			expect(stored?.status).to.equal('done');
			expect(stored?.s3_transcription_key).to.equal('transcriptions/done.json');
            expect(stored?.updated_at.getTime()).to.equal(transcription.updated_at.getTime());
		});

		for (const initialStatus of ['created', 'processing', 'restarted'] as const) {
			it(`overrides ${initialStatus} with ${reason} webhook`, async () => {
				const owner = await createTestUser(usersRepo);
				const video = await createTestVideoRecord(videosRepo, owner.id);
				const transcription = await createTestInterviewTranscription(transcriptionsRepo, video.id, {
					status: initialStatus,
					s3_transcription_key: null,
				});

				const payload = buildWebhookPayload({
					reason,
					videoId: video.id,
					transcriptionId: transcription.id,
				});

				const res = await sdk.sendFailWebhook({
					params: payload,
					userMeta: { isAuth: false },
					headers: buildWebhookHeaders(payload, webhookConfig),
				});

				expect(res.status).to.equal(HttpStatus.OK);
				if (res.status !== HttpStatus.OK) throw new Error('Webhook request failed');
				expect(res.body.status).to.equal(reason);

				const stored = await transcriptionsRepo.findById(transcription.id);
				expect(stored?.status).to.equal(reason);
			});
		}
	}

	it('does not update cancelled webhook when transcription status is cancelled', async () => {
		const owner = await createTestUser(usersRepo);
		const video = await createTestVideoRecord(videosRepo, owner.id);
		const transcription = await createTestInterviewTranscription(transcriptionsRepo, video.id, {
			status: 'cancelled',
			s3_transcription_key: null,
		});

		const payload = buildWebhookPayload({
			reason: 'cancelled',
			videoId: video.id,
			transcriptionId: transcription.id,
		});

		const res = await sdk.sendFailWebhook({
			params: payload,
			userMeta: { isAuth: false },
			headers: buildWebhookHeaders(payload, webhookConfig),
		});

		expect(res.status).to.equal(HttpStatus.OK);
		if (res.status !== HttpStatus.OK) throw new Error('Webhook request failed');
		expect(res.body.status).to.equal('cancelled');

		const stored = await transcriptionsRepo.findById(transcription.id);
		expect(stored?.status).to.equal('cancelled');
        expect(stored?.updated_at.getTime()).to.equal(transcription.updated_at.getTime());
	});

	it('does not update cancelled webhook when transcription status is failed', async () => {
		const owner = await createTestUser(usersRepo);
		const video = await createTestVideoRecord(videosRepo, owner.id);
		const transcription = await createTestInterviewTranscription(transcriptionsRepo, video.id, {
			status: 'failed',
			s3_transcription_key: null,
		});

		const payload = buildWebhookPayload({
			reason: 'cancelled',
			videoId: video.id,
			transcriptionId: transcription.id,
		});

		const res = await sdk.sendFailWebhook({
			params: payload,
			userMeta: { isAuth: false },
			headers: buildWebhookHeaders(payload, webhookConfig),
		});

		expect(res.status).to.equal(HttpStatus.OK);
		if (res.status !== HttpStatus.OK) throw new Error('Webhook request failed');
		expect(res.body.status).to.equal('failed');

		const stored = await transcriptionsRepo.findById(transcription.id);
		expect(stored?.status).to.equal('failed');
        expect(stored?.updated_at.getTime()).to.equal(transcription.updated_at.getTime());
	});

	it('does not update failed webhook when transcription status is cancelled', async () => {
		const owner = await createTestUser(usersRepo);
		const video = await createTestVideoRecord(videosRepo, owner.id);
		const transcription = await createTestInterviewTranscription(transcriptionsRepo, video.id, {
			status: 'cancelled',
			s3_transcription_key: null,
		});

		const payload = buildWebhookPayload({
			reason: 'failed',
			videoId: video.id,
			transcriptionId: transcription.id,
		});

		const res = await sdk.sendFailWebhook({
			params: payload,
			userMeta: { isAuth: false },
			headers: buildWebhookHeaders(payload, webhookConfig),
		});

		expect(res.status).to.equal(HttpStatus.OK);
		if (res.status !== HttpStatus.OK) throw new Error('Webhook request failed');
		expect(res.body.status).to.equal('cancelled');

		const stored = await transcriptionsRepo.findById(transcription.id);
		expect(stored?.status).to.equal('cancelled');
        expect(stored?.updated_at.getTime()).to.equal(transcription.updated_at.getTime());
	});

	it('does not update failed webhook when transcription status is failed', async () => {
		const owner = await createTestUser(usersRepo);
		const video = await createTestVideoRecord(videosRepo, owner.id);
		const transcription = await createTestInterviewTranscription(transcriptionsRepo, video.id, {
			status: 'failed',
			s3_transcription_key: null,
		});

		const payload = buildWebhookPayload({
			reason: 'failed',
			videoId: video.id,
			transcriptionId: transcription.id,
		});

		const res = await sdk.sendFailWebhook({
			params: payload,
			userMeta: { isAuth: false },
			headers: buildWebhookHeaders(payload, webhookConfig),
		});

		expect(res.status).to.equal(HttpStatus.OK);
		if (res.status !== HttpStatus.OK) throw new Error('Webhook request failed');
		expect(res.body.status).to.equal('failed');

		const stored = await transcriptionsRepo.findById(transcription.id);
		expect(stored?.status).to.equal('failed');
        expect(stored?.updated_at.getTime()).to.equal(transcription.updated_at.getTime());
	});
});

const buildWebhookPayload = ({
	reason,
	videoId,
	transcriptionId,
}: {
	reason: 'failed' | 'cancelled';
	videoId: string;
	transcriptionId: string;
}): InterviewWorkflowFailedCancelledWebhookPayload => {
	if (reason === 'failed') {
		return {
			reason,
			videoId,
			transcriptionId,
			errorMessage: 'worker crashed',
		};
	}

	return {
		reason,
		videoId,
		transcriptionId,
	};
};

const buildWebhookHeaders = (
	payload: InterviewWorkflowFailedCancelledWebhookPayload,
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
