import { ValidateSDK, UserMeta } from "../../../test/test.abstract.sdk";
import { TestHttpClient } from "../../../test/test.http-client";
import { GiftAcceptedResponseDto } from "../dto/gift-accept-response.dto";
import { GiftSubscriptionResponseDto } from "../dto/gift-response.dto";
import { GiftSubscriptionDto } from "../dto/gift-subscription.dto";

export class GiftTestSdk implements ValidateSDK<GiftTestSdk> {
	constructor(private readonly testClient: TestHttpClient) {}

	async giftSubscription({ params, userMeta }: { params: GiftSubscriptionDto; userMeta: UserMeta }) {
		return this.testClient.request<GiftSubscriptionResponseDto>({
			path: '/subscriptions/gift',
			method: 'POST',
			body: params,
			userMeta,
		});
	}

	async acceptGiftSubscription({ params, userMeta }: { params: { giftId: string }; userMeta: UserMeta }) {
		return this.testClient.request<GiftAcceptedResponseDto>({
			path: `/subscriptions/gift/${params.giftId}`,
			method: 'PATCH',
			userMeta,
		});
	}

}
