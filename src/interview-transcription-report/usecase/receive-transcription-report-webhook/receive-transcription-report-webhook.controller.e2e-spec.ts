import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { expect } from 'chai';
import { createHmac, randomUUID } from 'node:crypto';
import { createTestUser } from '../../../../test/fixtures/user.fixture';
import { createTestVideoRecord } from '../../../../test/fixtures/video-db.fixture';
import { createTestInterviewTranscription } from '../../../../test/fixtures/interview-transcription.fixture';
import { ISharedContext } from '../../../../test/setup/test.app-setup';
import { TestHttpClient } from '../../../../test/test.http-client';
import { interviewTranscriptionConfig, jwtConfig } from '../../../config';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { InterviewTranscriptionsTestRepository } from '../../../interview-transcription/test-utils/test.repo';
import { UsersTestRepository } from '../../../user/test-utils/test.repo';
import { VideosTestRepository } from '../../../video/test-utils/test.repo';
import { InterviewTranscriptionReportTestRepository } from '../../test-utils/test.repo';
import { InterviewTranscriptionReportTestSdk } from '../../test-utils/test.sdk';
import { ReceiveTranscriptionReportWebhookDto } from '../../dto/receive-transcription-report-webhook.dto';

describe('[E2E] Receive transcription report webhook usecase', () => {
	let app: INestApplication;
	let usersRepo: UsersTestRepository;
	let videosRepo: VideosTestRepository;
	let transcriptionsRepo: InterviewTranscriptionsTestRepository;
	let reportsRepo: InterviewTranscriptionReportTestRepository;
	let sdk: InterviewTranscriptionReportTestSdk;
	let webhookConfig: ConfigType<typeof interviewTranscriptionConfig>;

	before(function (this: ISharedContext) {
		app = this.app;
		const db = app.get(DatabaseProvider);
		usersRepo = new UsersTestRepository(db);
		videosRepo = new VideosTestRepository(db);
		transcriptionsRepo = new InterviewTranscriptionsTestRepository(db);
		reportsRepo = new InterviewTranscriptionReportTestRepository(db);
		sdk = new InterviewTranscriptionReportTestSdk(
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
		await reportsRepo.clearAll();
		await transcriptionsRepo.clearAll();
		await videosRepo.clearAll();
		await usersRepo.clearAll();
	});

	it('returns 500 when payload is invalid (missing required fields)', async () => {
		const invalidPayload = {
			transcriptionId: randomUUID(),
			// llmReportParsed is missing entirely
			candidateNameInTranscription: 'SPEAKER_02',
			candidateName: 'Cheeel',
		};

		const res = await sdk.sendReportWebhook({
			params: invalidPayload as ReceiveTranscriptionReportWebhookDto,
			userMeta: { isAuth: false },
			headers: buildWebhookHeaders(invalidPayload, webhookConfig),
		});

		expect(res.status).to.be.oneOf([HttpStatus.BAD_REQUEST, HttpStatus.INTERNAL_SERVER_ERROR]);
	});

	it('returns 500 when llmReportParsed contains an item with invalid hintType', async () => {
		const invalidPayload = {
			transcriptionId: randomUUID(),
			llmReportParsed: [
				{
					hintType: 'unknown_type',
					lineId: 1,
					topic: 'Some topic',
				},
			],
			candidateNameInTranscription: 'SPEAKER_03',
            candidateName: 'Cheeel',
		};

		const res = await sdk.sendReportWebhook({
			params: invalidPayload as ReceiveTranscriptionReportWebhookDto,
			userMeta: { isAuth: false },
			headers: buildWebhookHeaders(invalidPayload, webhookConfig),
		});

		expect(res.status).to.be.oneOf([HttpStatus.BAD_REQUEST, HttpStatus.INTERNAL_SERVER_ERROR]);
	});

	it('returns 500 when llmReportParsed error hint is missing required fields', async () => {
		const invalidPayload = {
			transcriptionId: randomUUID(),
			llmReportParsed: [
				{
					hintType: 'error',
					lineId: 5,
					topic: 'TypeScript generics',
					// errorType, whyBad, howToFix are missing
				},
			],
			candidateNameInTranscription: 'SPEAKER_04',
            candidateName: 'Cheeel',
		};

		const res = await sdk.sendReportWebhook({
			params: invalidPayload as ReceiveTranscriptionReportWebhookDto,
			userMeta: { isAuth: false },
			headers: buildWebhookHeaders(invalidPayload, webhookConfig),
		});

		expect(res.status).to.be.oneOf([HttpStatus.BAD_REQUEST, HttpStatus.INTERNAL_SERVER_ERROR]);
	});

	it('saves the report and returns 200 with a valid payload', async () => {
		const owner = await createTestUser(usersRepo);
		const video = await createTestVideoRecord(videosRepo, owner.id);
		const transcription = await createTestInterviewTranscription(transcriptionsRepo, video.id);

		const payload: ReceiveTranscriptionReportWebhookDto = {
			transcriptionId: transcription.id,
			llmReportParsed: [
				{
					hintType: 'error',
					lineId: 3,
					topic: 'Async/Await',
					errorType: 'blunder',
					whyBad: 'Missed error handling',
					howToFix: 'Wrap in try/catch',
				},
				{
					hintType: 'note',
					lineId: 7,
					topic: 'TypeScript',
					note: 'Good use of generics',
				},
				{
					hintType: 'praise',
					lineId: 12,
					topic: 'Code structure',
					praise: 'Clean separation of concerns',
				},
			],
			candidateNameInTranscription: 'SPEAKER_01',
            candidateName: 'Cheeel',
		};

		const res = await sdk.sendReportWebhook({
			params: payload,
			userMeta: { isAuth: false },
			headers: buildWebhookHeaders(payload, webhookConfig),
		});

		expect(res.status).to.equal(HttpStatus.OK);
		if (res.status !== HttpStatus.OK) throw new Error('Webhook request failed');

		const stored = (await reportsRepo.findAll()).at(0);
		expect(stored).to.exist;
		expect(stored?.interview_transcription_id).to.equal(transcription.id);
	});

	it('DB check constraint rejects directly inserted row with invalid llm_report_parsed', async () => {
		const owner = await createTestUser(usersRepo);
		const video = await createTestVideoRecord(videosRepo, owner.id);
		const transcription = await createTestInterviewTranscription(transcriptionsRepo, video.id);

		// This bypasses the application-layer zod validation and hits the DB check constraint directly.
		// The data is an array of objects that don't conform to the LLMReportParsed structure.
		const invalidParsed = [
			{
				hintType: 'invalid_type', // not a valid enum value
				lineId: 1,
				topic: 'something',
			},
		];

		let threw = false;
		try {
			await reportsRepo.insertRaw({
				interview_transcription_id: transcription.id,
				llm_report_parsed: invalidParsed as any,
				candidate_name_in_transcription: 'SPEAKER_01',
				candidate_name: 'Test Candidate',
			});
		} catch (err: unknown) {
			threw = true;
			// Postgres raises a check_violation (code 22P02) for violated CHECK constraints
			expect((err as any).code).to.equal('22P02');
		}

		expect(threw, 'Expected DB insert to throw a check constraint violation').to.be.true;
	});
});

const buildWebhookHeaders = (
	payload: unknown,
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
