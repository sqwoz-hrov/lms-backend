import { UserMeta, ValidateSDK } from '../../../test/test.abstract.sdk';
import { TestHttpClient } from '../../../test/test.http-client';
import { CreatePaymentFormDto, PaymentFormResponseDto } from '../dto/create-payment-form.dto';

export class PaymentTestSdk implements ValidateSDK<PaymentTestSdk> {
	constructor(private readonly testClient: TestHttpClient) {}

	async createPaymentForm({ params, userMeta }: { params: CreatePaymentFormDto; userMeta: UserMeta }) {
		return await this.testClient.request<PaymentFormResponseDto>({
			path: '/payments/forms',
			method: 'POST',
			body: params,
			userMeta,
		});
	}
}
