import { UserMeta, ValidateSDK } from '../../../test/test.abstract.sdk';
import { TestHttpClient } from '../../../test/test.http-client';
import { ChargeSubscriptionDto, ChargeSubscriptionResponseDto } from '../dto/charge-subscription.dto';
import { PaymentMethodConfirmationResponseDto } from '../dto/payment-method-confirmation-response.dto';

export class PaymentTestSdk implements ValidateSDK<PaymentTestSdk> {
	constructor(private readonly testClient: TestHttpClient) {}

	async chargeSubscription({ params, userMeta }: { params: ChargeSubscriptionDto; userMeta: UserMeta }) {
		return await this.testClient.request<ChargeSubscriptionResponseDto>({
			path: '/payments/charge',
			method: 'POST',
			body: params,
			userMeta,
		});
	}

	async addPaymentMethod({ userMeta }: { userMeta: UserMeta }) {
		return await this.testClient.request<PaymentMethodConfirmationResponseDto>({
			path: '/payments/payment-method',
			method: 'POST',
			userMeta,
		});
	}
}
