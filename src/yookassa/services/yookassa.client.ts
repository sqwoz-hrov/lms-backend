import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { yookassaConfig } from '../../config/yookassa.config';
import {
	ChargeSavedPaymentParams,
	CreatePaymentFormParams,
	YOOKASSA_CURRENCY_RUB,
	YookassaClientPort,
	YookassaPaymentResponse,
} from './yookassa-client.interface';

@Injectable()
export class YookassaClient implements YookassaClientPort {
	private readonly logger = new Logger(YookassaClient.name);
	private readonly baseUrl: string;
	private readonly basicAuthToken: string | null;
	private readonly oauthToken: string | null;

	constructor(@Inject(yookassaConfig.KEY) private readonly config: ConfigType<typeof yookassaConfig>) {
		this.baseUrl = this.config.apiUrl.replace(/\/+$/, '');
		this.oauthToken = this.config.oauthToken ?? null;
		this.basicAuthToken = `${Buffer.from(`${this.config.shopId}:${this.config.secretKey}`).toString('base64')}`;
	}

	private ensureReturnUrl(provided?: string): string {
		const resolved = provided ?? this.config.defaultReturnUrl;
		if (!resolved) throw new Error('Return URL is required to create a payment form');
		return resolved;
	}

	private serializeAmount(valueRubles: number) {
		if (!Number.isFinite(valueRubles) || valueRubles <= 0) {
			throw new Error('Payment amount must be a positive number');
		}
		return { value: valueRubles.toFixed(2), currency: YOOKASSA_CURRENCY_RUB };
	}

	private getAuthorizationToken(authorizationType: 'Basic' | 'Bearer') {
		if (authorizationType === 'Bearer') return `Bearer ${this.oauthToken}`;
		return;
	}

	private async req<T>(
		verb: 'GET' | 'POST' | 'DELETE' | 'PUT' | 'PATCH',
		path: string,
		opts: {
			body?: unknown;
			idempotenceKey?: string;
		} = {},
	): Promise<T> {
		const { body, idempotenceKey } = opts;
		const url = new URL(path, `${this.baseUrl}/`).toString();
		const headers: Record<string, string> = { Authorization: `Basic ${this.basicAuthToken}` };
		if (body !== undefined) headers['Content-Type'] = 'application/json';
		if (verb === 'POST' || verb === 'PUT' || verb === 'PATCH')
			headers['Idempotence-Key'] = idempotenceKey ?? randomUUID();

		const res = await fetch(url, {
			method: verb,
			headers,
			body: body !== undefined ? JSON.stringify(body) : undefined,
		});

		const txt = await res.text();
		let parsed: unknown = undefined;
		if (txt.length > 0) {
			try {
				parsed = JSON.parse(txt);
			} catch {
				parsed = txt;
			}
		}

		if (!res.ok) {
			this.logger.error(`YooKassa ${verb} ${path} failed (${res.status}): ${txt}`);
			throw new Error('YooKassa request failed');
		}

		return parsed as T;
	}

	async createPaymentForm(params: CreatePaymentFormParams): Promise<YookassaPaymentResponse> {
		const body = {
			amount: this.serializeAmount(params.amountRubles),
			capture: true,
			description: params.description,
			confirmation: {
				type: 'redirect',
				return_url: this.ensureReturnUrl(params.returnUrl),
			},
			save_payment_method: params.savePaymentMethod ?? true,
			metadata: params.metadata,
		};
		return await this.req<YookassaPaymentResponse>('POST', 'payments', {
			body,
			idempotenceKey: params.idempotenceKey,
		});
	}

	async chargeSavedPaymentMethod(params: ChargeSavedPaymentParams): Promise<YookassaPaymentResponse> {
		const body = {
			amount: this.serializeAmount(params.amountRubles),
			capture: true,
			description: params.description,
			payment_method_id: params.paymentMethodId,
			metadata: params.metadata,
		};
		return await this.req<YookassaPaymentResponse>('POST', 'payments', {
			body,
			idempotenceKey: params.idempotenceKey,
		});
	}
}
