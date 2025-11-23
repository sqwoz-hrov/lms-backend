import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
	ChargeSavedPaymentParams,
	CreatePaymentFormParams,
	CreatePaymentMethodParams,
	CreatePaymentMethodResponse,
	GetPaymentMethodParams,
	YOOKASSA_CURRENCY_RUB,
	YookassaClientPaymentMethodPort,
	YookassaClientPort,
	YookassaPaymentResponse,
	YookassaWebhook,
} from './yookassa-client.interface';
import { YookassaPaymentMethod } from '../../subscription/types/yookassa-webhook';

@Injectable()
export class FakeYookassaClient implements YookassaClientPort, YookassaClientPaymentMethodPort {
	private readonly webhooks = new Map<string, YookassaWebhook>();
	private readonly paymentMethods = new Map<string, YookassaPaymentMethod>();
	private lastCreatedPaymentMethod:
		| { params: CreatePaymentMethodParams; response: CreatePaymentMethodResponse }
		| undefined;

	private serializeAmount(valueRubles: number): YookassaPaymentResponse['amount'] {
		if (!Number.isFinite(valueRubles) || valueRubles <= 0) {
			throw new Error('Payment amount must be a positive number');
		}
		return { value: valueRubles.toFixed(2), currency: YOOKASSA_CURRENCY_RUB };
	}

	createPaymentForm(params: CreatePaymentFormParams): Promise<YookassaPaymentResponse> {
		const paymentId = `fake-payment-${randomUUID()}`;
		return Promise.resolve({
			id: paymentId,
			status: 'pending',
			paid: false,
			amount: this.serializeAmount(params.amountRubles),
			confirmation: {
				type: 'redirect',
				confirmation_url: params.returnUrl ?? `https://fake-payments.local/${paymentId}`,
			},
			metadata: params.metadata,
			payment_method: undefined,
			created_at: new Date().toISOString(),
		});
	}

	chargeSavedPaymentMethod(params: ChargeSavedPaymentParams): Promise<YookassaPaymentResponse> {
		const paymentId = `fake-payment-${randomUUID()}`;
		return Promise.resolve({
			id: paymentId,
			status: 'pending',
			paid: true,
			amount: this.serializeAmount(params.amountRubles),
			metadata: params.metadata,
			payment_method: {
				type: 'electronic_certificate',
				id: params.paymentMethodId,
				saved: true,
			},
			confirmation: { confirmation_url: '', type: '' },
			created_at: new Date().toISOString(),
		});
	}

	getPaymentMethod(params: GetPaymentMethodParams): Promise<YookassaPaymentMethod> {
		const method = this.paymentMethods.get(params.paymentMethodId);
		if (!method) throw new Error(`Fake YooKassa payment method ${params.paymentMethodId} not found`);
		return Promise.resolve(method);
	}

	createPaymentMethod(params: CreatePaymentMethodParams): Promise<CreatePaymentMethodResponse> {
		const methodId = `fake-payment-method-${randomUUID()}`;
		const response: CreatePaymentMethodResponse = {
			id: methodId,
			type: params.type,
			status: 'pending',
			saved: false,
			confirmation: {
				type: 'redirect',
				confirmation_url: params.returnUrl ?? `https://fake-payments.local/payment-method/${methodId}`,
			},
			metadata: params.metadata,
		};

		this.lastCreatedPaymentMethod = { params, response };

		return Promise.resolve(response);
	}

	registerPaymentMethod(method: YookassaPaymentMethod): void {
		this.paymentMethods.set(method.id, method);
	}

	clearRegisteredPaymentMethods(): void {
		this.paymentMethods.clear();
	}

	getLastCreatedPaymentMethodParams(): CreatePaymentMethodParams | undefined {
		return this.lastCreatedPaymentMethod?.params;
	}

	clearLastCreatedPaymentMethod(): void {
		this.lastCreatedPaymentMethod = undefined;
	}
}
