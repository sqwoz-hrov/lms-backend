import { UserMeta, ValidateSDK } from '../../../test/test.abstract.sdk';
import { TestHttpClient } from '../../../test/test.http-client';
import { GiftSubscriptionDto } from '../dto/gift-subscription.dto';
import { SubscriptionResponseDto } from '../dto/subscription-response.dto';
import { YookassaWebhookPayload } from '../types/yookassa-webhook';
import { DowngradeSubscriptionDto } from '../dto/downgrade-subscription.dto';
import { PaymentMethodResponseDto } from '../dto/payment-method-response.dto';

export class SubscriptionTestSdk implements ValidateSDK<SubscriptionTestSdk> {
	constructor(private readonly testClient: TestHttpClient) {}

	async giftSubscription({ params, userMeta }: { params: GiftSubscriptionDto; userMeta: UserMeta }) {
		return this.testClient.request<SubscriptionResponseDto>({
			path: '/subscriptions/gift',
			method: 'POST',
			body: params,
			userMeta,
		});
	}

	async downgradeSubscription({ params, userMeta }: { params: DowngradeSubscriptionDto; userMeta: UserMeta }) {
		return this.testClient.request<SubscriptionResponseDto>({
			path: '/subscriptions/downgrade',
			method: 'POST',
			body: params,
			userMeta,
		});
	}

	async sendYookassaWebhook({ params, userMeta }: { params: YookassaWebhookPayload; userMeta: UserMeta }) {
		return this.testClient.request<Record<string, never>>({
			path: '/webhooks/yookassa',
			method: 'POST',
			body: params,
			userMeta,
		});
	}

	async deletePaymentMethod({ userMeta }: { userMeta: UserMeta }) {
		return this.testClient.request<Record<string, never>>({
			path: '/subscriptions/payment-method',
			method: 'DELETE',
			userMeta,
		});
	}

	async getActivePaymentMethod({ userMeta }: { userMeta: UserMeta }) {
		return this.testClient.request<PaymentMethodResponseDto>({
			path: '/subscriptions/payment-method',
			method: 'GET',
			userMeta,
		});
	}
}
