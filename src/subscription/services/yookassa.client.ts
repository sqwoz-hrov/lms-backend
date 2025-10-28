import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { yookassaConfig } from '../../config/yookassa.config';

const CURRENCY_RUB = 'RUB';

export type YookassaWebhookEvent = 'payment.succeeded' | 'payment.canceled' | 'payment_method.active';

export interface YookassaWebhook {
	id: string;
	event: YookassaWebhookEvent;
	url: string;
}

export interface YookassaListWebhooksResponse {
	items: YookassaWebhook[];
}

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
	created_at: string;
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
export class YookassaClient implements OnModuleInit {
	private readonly logger = new Logger(YookassaClient.name);
	private readonly baseUrl: string;
	private readonly basicAuthToken: string | null;
	private readonly oauthToken: string | null;

	constructor(@Inject(yookassaConfig.KEY) private readonly config: ConfigType<typeof yookassaConfig>) {
		this.baseUrl = this.config.apiUrl.replace(/\/+$/, '');
		this.oauthToken = this.config.oauthToken ?? null;
		this.basicAuthToken = `${Buffer.from(`${this.config.shopId}:${this.config.secretKey}`).toString('base64')}`;
	}

	async onModuleInit(): Promise<void> {
		if (!this.oauthToken) {
			this.logger.warn('oauthToken is not configured — skipping API webhook setup.');
			this.logger.log('payment_method.active webhook must be enabled via YooKassa manager.');
			return;
		}

		const webhookUrl = this.config.webhookUrl;
		if (!webhookUrl) {
			this.logger.warn('config.webhookUrl is empty — cannot ensure webhooks.');
			return;
		}

		try {
			const desired: Array<Extract<YookassaWebhookEvent, 'payment.succeeded' | 'payment.canceled'>> = [
				'payment.succeeded',
				'payment.canceled',
			];
			const existing = await this.listWebhooks();
			for (const event of desired) {
				const already = existing.items?.some(w => w.event === event && w.url === webhookUrl);
				if (!already) {
					await this.createWebhook(event, webhookUrl);
					this.logger.log(`webhook created for ${event} → ${webhookUrl}`);
				} else {
					this.logger.log(`webhook already present for ${event} → ${webhookUrl}`);
				}
			}
			this.logger.log('payment_method.active webhook must be enabled via YooKassa manager.');
		} catch (err) {
			this.logger.error(`ensuring webhooks failed: ${(err as Error).message}`);
		}
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
		return { value: valueRubles.toFixed(2), currency: CURRENCY_RUB };
	}

	private getAuthorizationToken(authorizationType: 'Basic' | 'Bearer') {
		if (authorizationType === 'Bearer') return `Bearer ${this.oauthToken}`;
		return `Basic ${this.basicAuthToken}`;
	}

	private async req<T>(
		verb: 'GET' | 'POST' | 'DELETE' | 'PUT' | 'PATCH',
		path: string,
		opts: {
			body?: unknown;
			idempotenceKey?: string;
			authorizationType?: 'Basic' | 'Bearer';
		} = {},
	): Promise<T> {
		const { body, idempotenceKey, authorizationType = 'Basic' } = opts;
		const url = new URL(path, `${this.baseUrl}/`).toString();
		const headers: Record<string, string> = { Authorization: this.getAuthorizationToken(authorizationType) };
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

	async listWebhooks(): Promise<YookassaListWebhooksResponse> {
		return await this.req<YookassaListWebhooksResponse>('GET', 'webhooks', { authorizationType: 'Bearer' });
	}

	async createWebhook(event: Extract<YookassaWebhookEvent, 'payment.succeeded' | 'payment.canceled'>, url: string) {
		return await this.req<YookassaWebhook>('POST', 'webhooks', {
			authorizationType: 'Bearer',
			body: { event, url },
		});
	}

	async deleteWebhook(id: string): Promise<void> {
		await this.req<void>('DELETE', `webhooks/${encodeURIComponent(id)}`, { authorizationType: 'Bearer' });
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
		return await this.req<YookassaPaymentResponse>('POST', 'payments', {
			body,
			idempotenceKey: params.idempotenceKey,
		});
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
		return await this.req<YookassaPaymentResponse>('POST', 'payments', {
			body,
			idempotenceKey: params.idempotenceKey,
		});
	}
}
