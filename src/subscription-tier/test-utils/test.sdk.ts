import { UserMeta, ValidateSDK } from '../../../test/test.abstract.sdk';
import { TestHttpClient } from '../../../test/test.http-client';
import { SubscriptionTierResponseDto } from '../dto/base-subscription-tier.dto';
import { UpdateSubscriptionTierDto } from '../dto/update-subscription-tier.dto';

export class SubscriptionTiersTestSdk implements ValidateSDK<SubscriptionTiersTestSdk> {
	constructor(private readonly testClient: TestHttpClient) {}

	public async updateSubscriptionTier({ params, userMeta }: { params: UpdateSubscriptionTierDto; userMeta: UserMeta }) {
		return this.testClient.request<SubscriptionTierResponseDto>({
			path: '/subscription-tiers',
			method: 'PUT',
			userMeta,
			body: params,
		});
	}
}
