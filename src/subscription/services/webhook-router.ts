import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { Switch } from '../../common/utils/safe-guard';
import { SubscriptionTransaction } from '../subscription.repository';
import {
	YookassaPaymentCanceledWebhook,
	YookassaPaymentSucceededWebhook,
	YookassaWebhookPayload,
	yookassaPaymentCanceledWebhookSchema,
	yookassaPaymentMethodActiveWebhookSchema,
	yookassaPaymentSucceededWebhookSchema,
} from '../types/yookassa-webhook';
import { PaymentMethodWebhookHandler } from './payment-method-webhook.handler';
import { PaymentWebhookHandler } from './payment-webhook.handler';

export type PaymentWebhookPayload = YookassaPaymentSucceededWebhook | YookassaPaymentCanceledWebhook;

export interface WebhookRouteContext {
	userId: string | null;
	subscriptionId: string | null;
}

export interface WebhookRouteParams<TPayload extends YookassaWebhookPayload = YookassaWebhookPayload> {
	payload: TPayload;
	trx: SubscriptionTransaction;
	context: WebhookRouteContext;
}

type RawWebhookRouteParams = Omit<WebhookRouteParams, 'payload'> & { payload: unknown };

const webhookPayloadEventSchema = z.discriminatedUnion('event', [
	z
		.object({
			event: z.literal('payment.succeeded'),
		})
		.passthrough(),
	z
		.object({
			event: z.literal('payment.canceled'),
		})
		.passthrough(),
	z
		.object({
			event: z.literal('payment_method.active'),
		})
		.passthrough(),
]);

@Injectable()
export class YookassaWebhookRouter {
	constructor(
		private readonly paymentWebhookHandler: PaymentWebhookHandler,
		private readonly paymentMethodWebhookHandler: PaymentMethodWebhookHandler,
	) {}

	async route({ payload: rawPayload, trx, context }: RawWebhookRouteParams): Promise<void> {
		const parsedPayload = webhookPayloadEventSchema.safeParse(rawPayload);
		if (!parsedPayload.success) {
			const event =
				rawPayload !== null && typeof rawPayload === 'object' ? (rawPayload as { event?: unknown }).event : undefined;
			if (typeof event === 'string') {
				throw new Error(`Unknown webhook event: ${event}`);
			}
			throw parsedPayload.error;
		}
		const payload = parsedPayload.data;

		switch (payload.event) {
			case 'payment.succeeded': {
				const paymentWebhook = yookassaPaymentSucceededWebhookSchema.parse(payload);
				const params: WebhookRouteParams<typeof paymentWebhook> = {
					payload: paymentWebhook,
					trx,
					context,
				};
				await this.paymentWebhookHandler.handle(params);
				return;
			}
			case 'payment.canceled': {
				const paymentWebhook = yookassaPaymentCanceledWebhookSchema.parse(payload);
				const params: WebhookRouteParams<typeof paymentWebhook> = {
					payload: paymentWebhook,
					trx,
					context,
				};
				await this.paymentWebhookHandler.handle(params);
				return;
			}
			case 'payment_method.active': {
				const paymentMethodWebhook = yookassaPaymentMethodActiveWebhookSchema.parse(payload);
				const params: WebhookRouteParams<typeof paymentMethodWebhook> = {
					payload: paymentMethodWebhook,
					trx,
					context,
				};
				await this.paymentMethodWebhookHandler.handle(params);
				return;
			}
			default:
				Switch.safeGuard(payload);
		}
	}
}
