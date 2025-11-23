import {
	EventMetadata,
	YookassaPaymentMethod,
	YookassaPaymentMethodType,
} from '../../subscription/types/yookassa-webhook';

export const YOOKASSA_CURRENCY_RUB = 'RUB';

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
	confirmation: {
		type: string;
		confirmation_url: string;
	};
	payment_method?: YookassaPaymentMethod;
	metadata?: Record<string, unknown>;
	created_at: string;
}

export interface CreatePaymentFormParams {
	amountRubles: number;
	description: string;
	returnUrl?: string;
	savePaymentMethod?: boolean;
	metadata: EventMetadata;
	idempotenceKey?: string;
}

export interface ChargeSavedPaymentParams {
	amountRubles: number;
	description: string;
	paymentMethodId: string;
	metadata: EventMetadata;
	idempotenceKey?: string;
}

export interface GetPaymentMethodParams {
	paymentMethodId: string;
}

export type PaymentMethodMetadata = {
	user_id: string;
};

export interface CreatePaymentMethodParams {
	type: YookassaPaymentMethodType;
	returnUrl?: string;
	metadata: PaymentMethodMetadata;
	idempotenceKey?: string;
}

export interface YookassaPaymentMethodConfirmation {
	type: 'redirect';
	confirmation_url: string;
}

export interface CreatePaymentMethodResponse {
	id: string;
	type: YookassaPaymentMethodType;
	status: string;
	saved: boolean;
	confirmation?: YookassaPaymentMethodConfirmation;
	metadata?: PaymentMethodMetadata;
}

export interface YookassaClientPaymentMethodPort {
	getPaymentMethod(params: GetPaymentMethodParams): Promise<YookassaPaymentMethod>;
	createPaymentMethod(params: CreatePaymentMethodParams): Promise<CreatePaymentMethodResponse>;
}

export interface YookassaClientPort {
	createPaymentForm(params: CreatePaymentFormParams): Promise<YookassaPaymentResponse>;
	chargeSavedPaymentMethod(params: ChargeSavedPaymentParams): Promise<YookassaPaymentResponse>;
}
