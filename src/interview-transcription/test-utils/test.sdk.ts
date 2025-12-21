import { UserMeta, ValidateSDK } from '../../../test/test.abstract.sdk';
import { TestHttpClient } from '../../../test/test.http-client';
import { InterviewTranscriptionResponseDto } from '../dto/interview-transcription-response.dto';
import { RestartInterviewTranscriptionDto } from '../dto/restart-interview-transcription.dto';
import { StartInterviewTranscriptionDto } from '../dto/start-interview-transcription.dto';
import { InterviewTranscriptionWebhookDto } from '../dto/interview-transcription-webhook.dto';

export class InterviewTranscriptionsTestSdk implements ValidateSDK<InterviewTranscriptionsTestSdk> {
	constructor(private readonly httpClient: TestHttpClient) {}

	private buildQuery(params?: Record<string, string | undefined>): string {
		if (!params) {
			return '';
		}

		const entries = Object.entries(params).filter(([, value]) => value !== undefined && value !== null) as [
			string,
			string,
		][];

		if (entries.length === 0) {
			return '';
		}

		const searchParams = new URLSearchParams();
		for (const [key, value] of entries) {
			searchParams.set(key, value);
		}

		return `?${searchParams.toString()}`;
	}

	async startTranscription({ params, userMeta }: { params: StartInterviewTranscriptionDto; userMeta: UserMeta }) {
		return await this.httpClient.request<InterviewTranscriptionResponseDto>({
			path: '/interview-transcriptions',
			method: 'POST',
			body: params,
			userMeta,
		});
	}

	async restartTranscription({ params, userMeta }: { params: RestartInterviewTranscriptionDto; userMeta: UserMeta }) {
		return await this.httpClient.request<InterviewTranscriptionResponseDto>({
			path: '/interview-transcriptions/restart',
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

	async listTranscriptions({ userMeta, params }: { userMeta: UserMeta; params: { user_id?: string } }) {
		const search = this.buildQuery(params);
		return await this.httpClient.request<InterviewTranscriptionResponseDto[]>({
			path: `/interview-transcriptions${search}`,
			method: 'GET',
			userMeta,
		});
	}

	async getTranscriptionByVideoId({ userMeta, params }: { userMeta: UserMeta; params: { video_id: string } }) {
		return await this.httpClient.request<InterviewTranscriptionResponseDto>({
			path: `/interview-transcriptions/by-video-id/${params.video_id}`,
			method: 'GET',
			userMeta,
		});
	}

	async getTranscription({ userMeta, params }: { userMeta: UserMeta; params: { transcription_id: string } }) {
		return await this.httpClient.request<InterviewTranscriptionResponseDto>({
			path: `/interview-transcriptions/${params.transcription_id}`,
			method: 'GET',
			userMeta,
		});
	}
}
