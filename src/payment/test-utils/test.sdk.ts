import { UserMeta, ValidateSDK } from '../../../test/test.abstract.sdk';
import { TestHttpClient } from '../../../test/test.http-client';
import { randomUUID } from 'crypto';
import { ChargeSubscriptionDto, ChargeSubscriptionResponseDto } from '../dto/charge-subscription.dto';
import { ObtainGiftDto, ObtainGiftResponseDto } from '../dto/obtain-gift.dto';
import { GetPaymentHistoryDto } from '../dto/get-payment-history.dto';
import { PaymentHistoryResponseDto } from '../dto/payment-history-response.dto';
import { PaymentMethodConfirmationResponseDto } from '../dto/payment-method-confirmation-response.dto';

export class PaymentTestSdk implements ValidateSDK<PaymentTestSdk> {
	constructor(private readonly testClient: TestHttpClient) {}

	async obtainGift({
		params,
		userMeta,
		idempotenceKey = randomUUID(),
	}: {
		params: ObtainGiftDto;
		userMeta: UserMeta;
		idempotenceKey?: string | null;
	}) {
		return this.testClient.request<ObtainGiftResponseDto>({
			path: '/payments/obtain-gift',
			method: 'POST',
			body: params,
			headers: { 'Idempotence-Key': idempotenceKey },
			userMeta,
		});
	}

	async chargeSubscription({
		params,
		userMeta,
		idempotenceKey = randomUUID(),
	}: {
		params: ChargeSubscriptionDto;
		userMeta: UserMeta;
		idempotenceKey?: string | null;
	}) {
		return await this.testClient.request<ChargeSubscriptionResponseDto>({
			path: '/payments/charge',
			method: 'POST',
			body: params,
			headers: { 'Idempotence-Key': idempotenceKey },
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

	async getPaymentHistory({ params, userMeta }: { params?: GetPaymentHistoryDto; userMeta: UserMeta }) {
		const searchParams = new URLSearchParams();

		if (params?.page !== undefined) {
			searchParams.set('page', String(params.page));
		}

		if (params?.pageSize !== undefined) {
			searchParams.set('pageSize', String(params.pageSize));
		}

		return await this.testClient.request<PaymentHistoryResponseDto>({
			path: `/payments/history${searchParams.size > 0 ? `?${searchParams.toString()}` : ''}`,
			method: 'GET',
			userMeta,
		});
	}
}
