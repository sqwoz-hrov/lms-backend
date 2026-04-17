import { UserMeta, ValidateSDK } from '../../../test/test.abstract.sdk';
import { TestHttpClient } from '../../../test/test.http-client';
import { LimitsResponseDto } from '../dto/limits-response.dto';

export class LimitsTestSdk implements ValidateSDK<LimitsTestSdk> {
	constructor(private readonly testClient: TestHttpClient) {}

	async getLimits({ userMeta }: { userMeta: UserMeta }) {
		return this.testClient.request<LimitsResponseDto>({
			path: '/limits',
			method: 'GET',
			userMeta,
		});
	}
}
