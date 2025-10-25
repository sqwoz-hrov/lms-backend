import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { yookassaConfig } from '../../config/yookassa.config';

const CURRENCY_RUB = 'RUB';

export interface YookassaPaymentResponse {
	id: string;
	status: string;
	paid: boolean;
	amount: {
		value: string;
		currency: string;
	};
	confirmation?: {
		type: string;
		confirmation_url?: string;
	};
	payment_method?: {
		type?: string;
		id?: string;
		saved?: boolean;
		title?: string;
	};
	metadata?: Record<string, unknown>;
	created_at?: string;
}

export interface CreatePaymentFormParams {
	amountRubles: number;
	description: string;
	userId: string;
	subscriptionId: string;
	returnUrl?: string;
	savePaymentMethod?: boolean;
	metadata?: Record<string, unknown>;
	idempotenceKey?: string;
}

export interface ChargeSavedPaymentParams {
	amountRubles: number;
	description: string;
	userId: string;
	subscriptionId: string;
	paymentMethodId: string;
	metadata?: Record<string, unknown>;
	idempotenceKey?: string;
}

@Injectable()
export class YookassaClient {
	private readonly logger = new Logger(YookassaClient.name);
	private readonly baseUrl: string;
	private readonly authHeader: string;

	constructor(@Inject(yookassaConfig.KEY) private readonly config: ConfigType<typeof yookassaConfig>) {
		this.baseUrl = this.config.apiUrl.replace(/\/+$/, '');
		this.authHeader = `Basic ${Buffer.from(`${this.config.shopId}:${this.config.secretKey}`).toString('base64')}`;
	}

	private ensureReturnUrl(provided?: string): string {
		const resolved = provided ?? this.config.defaultReturnUrl;
		if (!resolved) {
			throw new Error('Return URL is required to create a payment form');
		}
		return resolved;
	}

	private serializeAmount(valueRubles: number) {
		if (!Number.isFinite(valueRubles) || valueRubles <= 0) {
			throw new Error('Payment amount must be a positive number');
		}
		return {
			value: valueRubles.toFixed(2),
			currency: CURRENCY_RUB,
		};
	}

	private async post<T>(path: string, body: unknown, idempotenceKey?: string): Promise<T> {
		const key = idempotenceKey ?? randomUUID();
		const url = new URL(path, `${this.baseUrl}/`).toString();
		const response = await fetch(url, {
			method: 'POST',
			body: JSON.stringify(body),
			headers: {
				'Content-Type': 'application/json',
				'Idempotence-Key': key,
				Authorization: this.authHeader,
			},
		});
		const responseText = await response.text();
		let parsedBody: unknown = undefined;
		if (responseText.length > 0) {
			try {
				parsedBody = JSON.parse(responseText);
			} catch {
				parsedBody = responseText;
			}
		}

		if (!response.ok) {
			this.logger.error(`YooKassa request to ${path} failed (${response.status}): ${JSON.stringify(parsedBody)}`);
			throw new Error('YooKassa request failed');
		}

		return parsedBody as T;
	}

	async createPaymentForm(params: CreatePaymentFormParams): Promise<YookassaPaymentResponse> {
		const metadata = {
			user_id: params.userId,
			subscription_id: params.subscriptionId,
			...params.metadata,
		};

		const body = {
			amount: this.serializeAmount(params.amountRubles),
			capture: true,
			description: params.description,
			confirmation: {
				type: 'redirect',
				return_url: this.ensureReturnUrl(params.returnUrl),
			},
			save_payment_method: params.savePaymentMethod ?? true,
			metadata,
		};

		return await this.post<YookassaPaymentResponse>('payments', body, params.idempotenceKey);
	}

	async chargeSavedPaymentMethod(params: ChargeSavedPaymentParams): Promise<YookassaPaymentResponse> {
		const metadata = {
			user_id: params.userId,
			subscription_id: params.subscriptionId,
			...params.metadata,
		};

		const body = {
			amount: this.serializeAmount(params.amountRubles),
			capture: true,
			description: params.description,
			payment_method_id: params.paymentMethodId,
			metadata,
		};

		return await this.post<YookassaPaymentResponse>('payments', body, params.idempotenceKey);
	}
}
