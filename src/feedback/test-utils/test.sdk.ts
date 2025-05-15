import { ConfigType } from '@nestjs/config';
import { UserMeta, ValidateSDK } from '../../../test/test.abstract.sdk';
import { TestHttpClient } from '../../../test/test.http-client';
import { UserFactory } from '../../../test/test.user.factory';
import { jwtConfig } from '../../config';
import { BaseFeedbackDto } from '../dto/base-feedback.dto';
import { CreateFeedbackDto } from '../dto/create-feedback.dto';
import { GetAllFeedbackDto } from '../dto/get-all-feedback.dto';
import { UpdateFeedbackDto } from '../dto/update-feedback.dto';

export class FeedbackTestSdk implements ValidateSDK<FeedbackTestSdk> {
	private readonly jwtFactory: UserFactory;

	constructor(
		private readonly testClient: TestHttpClient,
		jwtOptions: ConfigType<typeof jwtConfig>,
	) {
		this.jwtFactory = new UserFactory(jwtOptions);
	}

	public async createFeedback({ params, userMeta }: { params: CreateFeedbackDto; userMeta: UserMeta }) {
		const user = this.jwtFactory.getToken(userMeta.userId);
		const jwt = userMeta.isAuth ? user.token : undefined;

		return this.testClient.request<BaseFeedbackDto>({
			path: '/feedback',
			method: 'POST',
			jwt,
			wrongJwt: userMeta.isWrongJwt,
			body: params,
		});
	}

	public async editFeedback({ params, userMeta }: { params: UpdateFeedbackDto; userMeta: UserMeta }) {
		const user = this.jwtFactory.getToken(userMeta.userId);
		const jwt = userMeta.isAuth ? user.token : undefined;

		return this.testClient.request<BaseFeedbackDto>({
			path: '/feedback',
			method: 'PUT',
			jwt,
			wrongJwt: userMeta.isWrongJwt,
			body: params,
		});
	}

	public async getFeedbackInfo({ params, userMeta }: { params: { id: string }; userMeta: UserMeta }) {
		const user = this.jwtFactory.getToken(userMeta.userId);
		const jwt = userMeta.isAuth ? user.token : undefined;

		return this.testClient.request<BaseFeedbackDto>({
			path: `/feedback/${params.id}`,
			method: 'GET',
			jwt,
			wrongJwt: userMeta.isWrongJwt,
		});
	}

	public async getAllFeedback({ params, userMeta }: { params: GetAllFeedbackDto; userMeta: UserMeta }) {
		const user = this.jwtFactory.getToken(userMeta.userId);
		const jwt = userMeta.isAuth ? user.token : undefined;

		const queryParams = new URLSearchParams();

		for (const [key, value] of Object.entries(params)) {
			if (value !== undefined) queryParams.append(key, value);
		}

		return this.testClient.request<BaseFeedbackDto[]>({
			path: `/feedback?${queryParams.toString()}`,
			method: 'GET',
			jwt,
			wrongJwt: userMeta.isWrongJwt,
		});
	}
}
