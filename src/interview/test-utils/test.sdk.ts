import { UserMeta, ValidateSDK } from '../../../test/test.abstract.sdk';
import { TestHttpClient } from '../../../test/test.http-client';
import { InterviewResponseDto } from '../dto/base-interview.dto';
import { CreateInterviewDto } from '../dto/create-interview.dto';
import { DeleteInterviewDto } from '../dto/delete-interview.dto';
import { GetInterviewsDto } from '../dto/get-interviews.dto';
import { UpdateInterviewDto } from '../dto/update-interview.dto';

export class InterviewsTestSdk implements ValidateSDK<InterviewsTestSdk> {
	constructor(private readonly testClient: TestHttpClient) {}

	public async createInterview({ params, userMeta }: { params: CreateInterviewDto; userMeta: UserMeta }) {
		return this.testClient.request<InterviewResponseDto>({
			path: '/interviews',
			method: 'POST',
			body: params,
			userMeta,
		});
	}

	public async editInterview({ params, userMeta }: { params: UpdateInterviewDto; userMeta: UserMeta }) {
		return this.testClient.request<InterviewResponseDto>({
			path: '/interviews',
			method: 'PUT',
			body: params,
			userMeta,
		});
	}

	public async deleteInterview({ params, userMeta }: { params: DeleteInterviewDto; userMeta: UserMeta }) {
		return this.testClient.request<InterviewResponseDto>({
			path: '/interviews',
			method: 'DELETE',
			body: params,
			userMeta,
		});
	}

	public async getInterviews({ params, userMeta }: { params: GetInterviewsDto; userMeta: UserMeta }) {
		const queryParams = new URLSearchParams();

		for (const [key, value] of Object.entries(params)) {
			queryParams.append(key, value);
		}

		return this.testClient.request<InterviewResponseDto[]>({
			path: `/interviews?${queryParams.toString()}`,
			method: 'GET',
			userMeta,
		});
	}
}
