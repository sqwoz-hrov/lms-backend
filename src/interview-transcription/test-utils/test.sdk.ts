import { UserMeta, ValidateSDK } from '../../../test/test.abstract.sdk';
import { TestHttpClient } from '../../../test/test.http-client';
import { InterviewTranscriptionResponseDto } from '../dto/interview-transcription-response.dto';
import { StartInterviewTranscriptionDto } from '../dto/start-interview-transcription.dto';
import { InterviewTranscriptionWebhookDto } from '../dto/interview-transcription-webhook.dto';

export class InterviewTranscriptionsTestSdk implements ValidateSDK<InterviewTranscriptionsTestSdk> {
	constructor(private readonly httpClient: TestHttpClient) {}

	async startTranscription({ params, userMeta }: { params: StartInterviewTranscriptionDto; userMeta: UserMeta }) {
		return await this.httpClient.request<InterviewTranscriptionResponseDto>({
			path: '/interview-transcriptions',
			method: 'POST',
			body: params,
			userMeta,
		});
	}

	async sendFinishWebhook({
		params,
		userMeta,
		headers,
	}: {
		params: InterviewTranscriptionWebhookDto;
		userMeta: UserMeta;
		headers?: Record<string, string>;
	}) {
		return await this.httpClient.request<InterviewTranscriptionResponseDto>({
			path: '/webhooks/interview-transcriptions/finish',
			method: 'POST',
			body: params,
			userMeta,
			headers,
		});
	}
}
