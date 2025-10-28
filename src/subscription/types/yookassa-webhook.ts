export interface EventMetadata {
	userId: string;
	subscriptionId: string;
}

export const SUPPORTED_EVENTS = new Set(['payment.succeeded', 'payment.canceled', 'payment_method.active']);

type YookassaCurrency = 'RUB';

type YookassaPaymentMethodType =
	| 'bank_card'
	| 'yoo_money'
	| 'sberbank'
	| 'tinkoff_bank'
	| 'sbp'
	| 'b2b_sberbank'
	| 'sber_loan';

interface YookassaAmount {
	value: string;
	currency: YookassaCurrency;
}

interface YookassaCardInfo {
	first6?: string;
	last4?: string;
	expiry_month?: string;
	expiry_year?: string;
	card_type?: string;
	issuer_country?: string;
	issuer_name?: string;
}

interface YookassaPaymentMethod {
	type: YookassaPaymentMethodType;
	id?: string;
	saved?: boolean;
	title?: string;
	card?: YookassaCardInfo;
}

export interface YookassaPaymentSucceededWebhook {
	event: 'payment.succeeded';
	object: {
		id: string;
		status: 'succeeded';
		paid: true;
		amount: YookassaAmount;
		income_amount?: YookassaAmount;
		description?: string;
		metadata?: Record<string, unknown>;
		created_at: string;
		captured_at?: string;
		payment_method?: YookassaPaymentMethod;
		refundable?: boolean;
		test?: boolean;
		receipt_registration?: 'pending' | 'succeeded' | 'canceled';
	};
}

export interface YookassaPaymentCanceledWebhook {
	event: 'payment.canceled';
	object: {
		id: string;
		status: 'canceled';
		paid: false | true;
		amount: YookassaAmount;
		description?: string;
		metadata?: Record<string, unknown>;
		created_at: string;
		canceled_at: string;
		cancellation_details?: {
			party?: string;
			reason?: string;
		};
		payment_method?: YookassaPaymentMethod;
		refundable?: boolean;
		test?: boolean;
	};
}

export interface YookassaPaymentMethodActiveWebhook {
	event: 'payment_method.active';
	object: {
		type: YookassaPaymentMethodType;
		id: string;
		saved: true;
		status: 'active';
		title?: string;
		created_at?: string;
		metadata?: Record<string, unknown>;
		card?: YookassaCardInfo;
	};
}

export type YookassaWebhookPayload =
	| YookassaPaymentSucceededWebhook
	| YookassaPaymentCanceledWebhook
	| YookassaPaymentMethodActiveWebhook;

export type PaymentWebhookEvent =
	| {
			type: 'payment.succeeded';
			occurredAt: Date;
	  }
	| {
			type: 'payment.canceled';
			occurredAt: Date;
	  };

export type PaymentMethodActiveWebhookEvent = {
	type: 'payment_method.active';
	occurredAt: Date;
	paymentMethodId: string;
};

export type WebhookEvent = PaymentWebhookEvent | PaymentMethodActiveWebhookEvent;
