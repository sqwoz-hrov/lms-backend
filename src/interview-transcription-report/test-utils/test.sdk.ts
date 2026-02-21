import { UserMetaWithoutAuth, ValidateSDK } from '../../../test/test.abstract.sdk';
import { TestHttpClient } from '../../../test/test.http-client';
import { InterviewTranscriptionReportResponseDto } from '../dto/interview-transcription-report-response.dto';
import { ReceiveTranscriptionReportWebhookDto } from '../dto/receive-transcription-report-webhook.dto';

export class InterviewTranscriptionReportTestSdk implements ValidateSDK<InterviewTranscriptionReportTestSdk> {
	constructor(private readonly httpClient: TestHttpClient) {}

	async sendReportWebhook({
		params,
		userMeta,
		headers,
	}: {
		params: ReceiveTranscriptionReportWebhookDto;
		userMeta: UserMetaWithoutAuth;
		headers?: Record<string, string>;
	}) {
		return await this.httpClient.request<InterviewTranscriptionReportResponseDto>({
			path: '/webhooks/interview-transcription-reports/receive',
			method: 'POST',
			body: params,
			userMeta,
			headers,
		});
	}
}
