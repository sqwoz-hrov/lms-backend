import { UserMeta, ValidateSDK } from '../../../test/test.abstract.sdk';
import { TestHttpClient } from '../../../test/test.http-client';
import { BaseFeedbackDto } from '../dto/base-feedback.dto';
import { CreateFeedbackDto } from '../dto/create-feedback.dto';
import { GetAllFeedbackDto } from '../dto/get-all-feedback.dto';
import { UpdateFeedbackDto } from '../dto/update-feedback.dto';

export class FeedbackTestSdk implements ValidateSDK<FeedbackTestSdk> {
	constructor(private readonly testClient: TestHttpClient) {}

	public async createFeedback({ params, userMeta }: { params: CreateFeedbackDto; userMeta: UserMeta }) {
		return this.testClient.request<BaseFeedbackDto>({
			path: '/feedback',
			method: 'POST',
			userMeta,
			body: params,
		});
	}

	public async editFeedback({ params, userMeta }: { params: UpdateFeedbackDto; userMeta: UserMeta }) {
		return this.testClient.request<BaseFeedbackDto>({
			path: '/feedback',
			method: 'PUT',
			userMeta,
			body: params,
		});
	}

	public async getFeedbackInfo({ params, userMeta }: { params: { id: string }; userMeta: UserMeta }) {
		return this.testClient.request<BaseFeedbackDto>({
			path: `/feedback/${params.id}`,
			method: 'GET',
			userMeta,
		});
	}

	public async getAllFeedback({ params, userMeta }: { params: GetAllFeedbackDto; userMeta: UserMeta }) {
		const queryParams = new URLSearchParams();

		for (const [key, value] of Object.entries(params)) {
			if (value !== undefined) queryParams.append(key, value);
		}

		return this.testClient.request<BaseFeedbackDto[]>({
			path: `/feedback?${queryParams.toString()}`,
			method: 'GET',
			userMeta,
		});
	}
}
