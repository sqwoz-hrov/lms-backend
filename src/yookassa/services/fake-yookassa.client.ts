import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
	ChargeSavedPaymentParams,
	CreatePaymentFormParams,
	YOOKASSA_CURRENCY_RUB,
	YookassaClientPort,
	YookassaListWebhooksResponse,
	YookassaPaymentResponse,
	YookassaWebhook,
	YookassaWebhookEvent,
} from './yookassa-client.interface';

@Injectable()
export class FakeYookassaClient implements YookassaClientPort {
	private readonly webhooks = new Map<string, YookassaWebhook>();

	private serializeAmount(valueRubles: number): YookassaPaymentResponse['amount'] {
		if (!Number.isFinite(valueRubles) || valueRubles <= 0) {
			throw new Error('Payment amount must be a positive number');
		}
		return { value: valueRubles.toFixed(2), currency: YOOKASSA_CURRENCY_RUB };
	}

	listWebhooks(): Promise<YookassaListWebhooksResponse> {
		return Promise.resolve({ items: Array.from(this.webhooks.values()) });
	}

	createWebhook(event: YookassaWebhookEvent, url: string): Promise<YookassaWebhook> {
		const webhook = { id: randomUUID(), event, url };
		this.webhooks.set(webhook.id, webhook);
		return Promise.resolve(webhook);
	}

	deleteWebhook(id: string): Promise<void> {
		this.webhooks.delete(id);
		return Promise.resolve();
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
			payment_method: params.savePaymentMethod === false ? undefined : { saved: true },
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
				type: 'saved_payment_method',
				id: params.paymentMethodId,
				saved: true,
			},
			confirmation: { confirmation_url: '', type: '' },
			created_at: new Date().toISOString(),
		});
	}
}
