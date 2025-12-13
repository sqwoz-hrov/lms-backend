import { Injectable, Logger } from '@nestjs/common';
import { Switch } from '../../common/utils/safe-guard';
import { SubscriptionRepository } from '../subscription.repository';
import { SubscriptionManagerFactory } from '../domain/subscription-manager.factory';
import { SubscriptionActionExecutor } from './subscription-action.executor';
import { EventMetadata, PaymentWebhookEvent } from '../types/yookassa-webhook';
import { PaymentWebhookPayload, WebhookRouteParams } from './webhook-router';

@Injectable()
export class PaymentWebhookHandler {
	private readonly logger = new Logger(PaymentWebhookHandler.name);

	constructor(
		private readonly subscriptionRepository: SubscriptionRepository,
		private readonly subscriptionManagerFactory: SubscriptionManagerFactory,
		private readonly subscriptionActionExecutor: SubscriptionActionExecutor,
	) {}

	async handle({ payload, trx, context }: WebhookRouteParams<PaymentWebhookPayload>): Promise<void> {
		const metadata = payload.object.metadata;

		if (!metadata) {
			this.logger.error(`Webhook ${payload.event} missing subscription metadata, skipping`);
			throw new Error('Invalid metadata');
		}

		context.userId = metadata.user_id;

		const manager = await this.subscriptionManagerFactory.create();
		const user = await trx
			.selectFrom('user')
			.selectAll()
			.where('id', '=', metadata.user_id)
			.forUpdate()
			.limit(1)
			.executeTakeFirst();

		if (!user) {
			this.logger.warn(`User ${metadata.user_id} not found for webhook ${payload.event}`);
			throw new Error('User not found');
		}

		const subscription = await this.subscriptionRepository.lockByUserId(metadata.user_id, trx);

		if (!subscription) {
			this.logger.warn(`Subscription for user_id ${metadata.user_id} not found for webhook ${payload.event}`);
			throw new Error('Subscription not found');
		}

		context.subscriptionId = subscription.id;

		if (metadata.user_id !== subscription.user_id) {
			this.logger.warn(
				`Webhook metadata user ${metadata.user_id} does not match subscription owner ${subscription.user_id}`,
			);
		}

		const event = this.buildEvent(payload, metadata);
		if (!event) {
			this.logger.warn(`Failed to build event payload for ${payload.event}`);
			return;
		}

		const { action } = manager.handlePaymentEvent({ user, subscription, event });

		await this.subscriptionActionExecutor.execute({
			action,
			trx,
		});
	}

	private buildEvent(payload: PaymentWebhookPayload, metadata: EventMetadata): PaymentWebhookEvent {
		const base = payload.object;
		switch (payload.event) {
			case 'payment.succeeded': {
				const occurredAt = this.parseDate(base.created_at);

				return { type: 'payment.succeeded', meta: metadata, paymentMethod: base.payment_method, occurredAt };
			}
			case 'payment.canceled': {
				const occurredAt = this.parseDate(base.created_at);

				return { type: 'payment.canceled', meta: metadata, paymentMethod: base.payment_method, occurredAt };
			}
			default:
				return Switch.safeGuard(payload, 'Build event failed');
		}
	}

	private parseDate(input?: string): Date {
		if (input === undefined) return new Date();
		const parsed = new Date(input);
		if (Number.isNaN(parsed.getTime())) throw new Error();
		return parsed;
	}
}
