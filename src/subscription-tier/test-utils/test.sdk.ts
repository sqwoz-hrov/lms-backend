import { UserMeta, ValidateSDK } from '../../../test/test.abstract.sdk';
import { TestHttpClient } from '../../../test/test.http-client';
import { SubscriptionTierResponseDto } from '../dto/base-subscription-tier.dto';
import { CreateSubscriptionTierDto } from '../dto/create-subscription-tier.dto';
import { DeleteSubscriptionTierDto } from '../dto/delete-subscription-tier.dto';
import { UpdateSubscriptionTierDto } from '../dto/update-subscription-tier.dto';

export class SubscriptionTiersTestSdk implements ValidateSDK<SubscriptionTiersTestSdk> {
	constructor(private readonly testClient: TestHttpClient) {}

	public async createSubscriptionTier({ params, userMeta }: { params: CreateSubscriptionTierDto; userMeta: UserMeta }) {
		return this.testClient.request<SubscriptionTierResponseDto>({
			path: '/subscription-tiers',
			method: 'POST',
			userMeta,
			body: params,
		});
	}

	public async getSubscriptionTiers({ userMeta }: { userMeta: UserMeta }) {
		return this.testClient.request<SubscriptionTierResponseDto[]>({
			path: '/subscription-tiers',
			method: 'GET',
			userMeta,
		});
	}

	public async updateSubscriptionTier({ params, userMeta }: { params: UpdateSubscriptionTierDto; userMeta: UserMeta }) {
		return this.testClient.request<SubscriptionTierResponseDto>({
			path: '/subscription-tiers',
			method: 'PUT',
			userMeta,
			body: params,
		});
	}

	public async deleteSubscriptionTier({ params, userMeta }: { params: DeleteSubscriptionTierDto; userMeta: UserMeta }) {
		return this.testClient.request<SubscriptionTierResponseDto>({
			path: '/subscription-tiers',
			method: 'DELETE',
			userMeta,
			body: params,
		});
	}
}
