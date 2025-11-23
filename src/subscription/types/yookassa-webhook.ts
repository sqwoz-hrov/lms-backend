import { z } from 'zod';

export const SUPPORTED_EVENTS = new Set(['payment.succeeded', 'payment.canceled', 'payment_method.active'] as const);

export const PAYMENT_METHOD_TYPES = [
	'bank_card',
	'yoo_money',
	'electronic_certificate',
	'sberbank',
	'tinkoff_bank',
	'sbp',
	'sber_loan',
	'sber_bnpl',
	'b2b_sberbank',
	'mobile_balance',
	'cash',
] as const;

export type YookassaPaymentMethodType = (typeof PAYMENT_METHOD_TYPES)[number];

const yookassaCurrencySchema = z.literal('RUB');

const amountSchema = z
	.object({
		value: z.string(),
		currency: yookassaCurrencySchema,
	})
	.passthrough();

const cardInfoSchema = z
	.object({
		first6: z.string().optional(),
		last4: z.string().optional(),
		expiry_month: z.string().optional(),
		expiry_year: z.string().optional(),
		card_type: z.string().optional(),
		issuer_country: z.string().optional(),
		issuer_name: z.string().optional(),
	})
	.passthrough();

export const paymentMethodMetadataSchema = z
	.object({
		user_id: z.string(),
	})
	.passthrough();

export const eventMetadataSchema = paymentMethodMetadataSchema
	.extend({
		subscription_tier_id: z.string(),
	})
	.passthrough();

const paymentMethodSchema = z
	.object({
		type: z.enum(PAYMENT_METHOD_TYPES),
		id: z.string(),
		saved: z.boolean(),
		title: z.string().optional(),
		card: cardInfoSchema.optional(),
	})
	.passthrough();

const paymentMethodWithMetadataSchema = paymentMethodSchema
	.extend({
		status: z.string().optional(),
		metadata: paymentMethodMetadataSchema.optional(),
	})
	.passthrough();

const paymentBaseSchema = z
	.object({
		id: z.string(),
		status: z.string(),
		paid: z.boolean(),
		amount: amountSchema,
		description: z.string().optional(),
		metadata: eventMetadataSchema.optional(),
		created_at: z.string(),
		payment_method: paymentMethodSchema.optional(),
		refundable: z.boolean().optional(),
		test: z.boolean().optional(),
	})
	.passthrough();

const paymentSucceededObjectSchema = paymentBaseSchema
	.extend({
		status: z.literal('succeeded'),
		paid: z.literal(true),
		income_amount: amountSchema.optional(),
		captured_at: z.string().optional(),
		receipt_registration: z.enum(['pending', 'succeeded', 'canceled']).optional(),
	})
	.passthrough();

const paymentCanceledObjectSchema = paymentBaseSchema
	.extend({
		status: z.literal('canceled'),
		paid: z.boolean(),
		canceled_at: z.string(),
		cancellation_details: z
			.object({
				party: z.string().optional(),
				reason: z.string().optional(),
			})
			.passthrough()
			.optional(),
	})
	.passthrough();

const paymentMethodActiveObjectSchema = paymentMethodWithMetadataSchema
	.extend({
		status: z.literal('active'),
	})
	.passthrough();

export const yookassaPaymentSucceededWebhookSchema = z
	.object({
		event: z.literal('payment.succeeded'),
		object: paymentSucceededObjectSchema,
	})
	.passthrough();

export const yookassaPaymentCanceledWebhookSchema = z
	.object({
		event: z.literal('payment.canceled'),
		object: paymentCanceledObjectSchema,
	})
	.passthrough();

export const yookassaPaymentMethodActiveWebhookSchema = z
	.object({
		event: z.literal('payment_method.active'),
		object: paymentMethodActiveObjectSchema,
	})
	.passthrough();

export const yookassaWebhookSchema = z.discriminatedUnion('event', [
	yookassaPaymentSucceededWebhookSchema,
	yookassaPaymentCanceledWebhookSchema,
	yookassaPaymentMethodActiveWebhookSchema,
]);

export type PaymentMethodMetadata = z.infer<typeof paymentMethodMetadataSchema>;
export type EventMetadata = z.infer<typeof eventMetadataSchema>;
export type YookassaPaymentMethod = z.infer<typeof paymentMethodSchema>;
export type YookassaPaymentMethodWithMetadata = z.infer<typeof paymentMethodWithMetadataSchema>;
export type YookassaPaymentSucceededWebhook = z.infer<typeof yookassaPaymentSucceededWebhookSchema>;
export type YookassaPaymentCanceledWebhook = z.infer<typeof yookassaPaymentCanceledWebhookSchema>;
export type YookassaPaymentMethodActiveWebhook = z.infer<typeof yookassaPaymentMethodActiveWebhookSchema>;
export type YookassaWebhookPayload = z.infer<typeof yookassaWebhookSchema>;

export type PaymentWebhookEvent =
	| {
			type: 'payment.succeeded';
			meta: EventMetadata;
			paymentMethod?: YookassaPaymentMethod;
			occurredAt: Date;
	  }
	| {
			type: 'payment.canceled';
			meta: EventMetadata;
			paymentMethod?: YookassaPaymentMethod;
			occurredAt: Date;
	  };
