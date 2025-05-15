import { ConfigType } from '@nestjs/config';
import { UserMeta, ValidateSDK } from '../../../test/test.abstract.sdk';
import { TestHttpClient } from '../../../test/test.http-client';
import { UserFactory } from '../../../test/test.user.factory';
import { jwtConfig } from '../../config';
import { InterviewResponseDto } from '../dto/base-interview.dto';
import { CreateInterviewDto } from '../dto/create-interview.dto';
import { UpdateInterviewDto } from '../dto/update-interview.dto';
import { DeleteInterviewDto } from '../dto/delete-interview.dto';
import { GetInterviewsDto } from '../dto/get-interviews.dto';

export class InterviewsTestSdk implements ValidateSDK<InterviewsTestSdk> {
	private readonly jwtFactory: UserFactory;

	constructor(
		private readonly testClient: TestHttpClient,
		jwtOptions: ConfigType<typeof jwtConfig>,
	) {
		this.jwtFactory = new UserFactory(jwtOptions);
	}

	public async createInterview({ params, userMeta }: { params: CreateInterviewDto; userMeta: UserMeta }) {
		const user = this.jwtFactory.getToken(userMeta.userId);
		const jwt = userMeta.isAuth ? user.token : undefined;

		return this.testClient.request<InterviewResponseDto>({
			path: '/interviews',
			method: 'POST',
			body: params,
			jwt,
			wrongJwt: userMeta.isWrongJwt,
		});
	}

	public async editInterview({ params, userMeta }: { params: UpdateInterviewDto; userMeta: UserMeta }) {
		const user = this.jwtFactory.getToken(userMeta.userId);
		const jwt = userMeta.isAuth ? user.token : undefined;

		return this.testClient.request<InterviewResponseDto>({
			path: '/interviews',
			method: 'PUT',
			body: params,
			jwt,
			wrongJwt: userMeta.isWrongJwt,
		});
	}

	public async deleteInterview({ params, userMeta }: { params: DeleteInterviewDto; userMeta: UserMeta }) {
		const user = this.jwtFactory.getToken(userMeta.userId);
		const jwt = userMeta.isAuth ? user.token : undefined;

		return this.testClient.request<InterviewResponseDto>({
			path: '/interviews',
			method: 'DELETE',
			body: params,
			jwt,
			wrongJwt: userMeta.isWrongJwt,
		});
	}

	public async getInterviews({ params, userMeta }: { params: GetInterviewsDto; userMeta: UserMeta }) {
		const user = this.jwtFactory.getToken(userMeta.userId);
		const jwt = userMeta.isAuth ? user.token : undefined;

		const queryParams = new URLSearchParams();

		for (const [key, value] of Object.entries(params)) {
			queryParams.append(key, value);
		}

		return this.testClient.request<InterviewResponseDto[]>({
			path: `/interviews?${queryParams.toString()}`,
			method: 'GET',
			jwt,
			wrongJwt: userMeta.isWrongJwt,
		});
	}
}
