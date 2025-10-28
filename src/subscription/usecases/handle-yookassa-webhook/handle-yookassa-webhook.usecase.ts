import { Injectable, Logger } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { Switch } from '../../../common/utils/safe-guard';
import { SubscriptionManagerFactory } from '../../domain/subscription-manager.factory';
import { SubscriptionActionExecutor } from '../../services/subscription-action.executor';
import { SubscriptionRepository } from '../../subscription.repository';
import { EventMetadata, SUPPORTED_EVENTS, WebhookEvent, YookassaWebhookPayload } from '../../types/yookassa-webhook';

@Injectable()
export class HandleYookassaWebhookUsecase implements UsecaseInterface {
	private readonly logger = new Logger(HandleYookassaWebhookUsecase.name);

	constructor(
		private readonly subscriptionRepository: SubscriptionRepository,
		private readonly subscriptionManagerFactory: SubscriptionManagerFactory,
		private readonly subscriptionActionExecutor: SubscriptionActionExecutor,
	) {}

	async execute(payload: YookassaWebhookPayload): Promise<void> {
		if (!SUPPORTED_EVENTS.has(payload.event)) {
			this.logger.debug(`Ignoring unsupported event ${payload.event}`);
			return;
		}

		const metadata = this.extractMetadata(payload.object?.metadata);
		if (!metadata) {
			this.logger.warn(`Webhook ${payload.event} missing subscription metadata, skipping`);
			return;
		}

		const manager = await this.subscriptionManagerFactory.create();

		await this.subscriptionRepository.transaction(async trx => {
			const subscription = await this.subscriptionRepository.lockById(metadata.subscriptionId, trx);
			if (!subscription) {
				this.logger.warn(`Subscription ${metadata.subscriptionId} not found for webhook ${payload.event}`);
				return;
			}

			const user = await trx
				.selectFrom('user')
				.selectAll()
				.where('id', '=', subscription.user_id)
				.forUpdate()
				.limit(1)
				.executeTakeFirst();

			if (!user) {
				this.logger.warn(`User ${subscription.user_id} not found for webhook ${payload.event}`);
				return;
			}

			if (metadata.userId !== subscription.user_id) {
				this.logger.warn(
					`Webhook metadata user ${metadata.userId} does not match subscription owner ${subscription.user_id}`,
				);
			}

			await this.subscriptionRepository.insertPaymentEvent(
				{
					user_id: subscription.user_id,
					subscription_id: subscription.id,
					event: payload,
				},
				trx,
			);

			const event = this.buildEvent(payload);
			if (!event) {
				this.logger.warn(`Failed to build event payload for ${payload.event}`);
				return;
			}

			if (event.type === 'payment_method.active') {
				await this.subscriptionRepository.upsertPaymentMethod(
					{
						userId: subscription.user_id,
						paymentMethodId: event.paymentMethodId,
					},
					trx,
				);
				return;
			}

			const { action } = manager.handlePaymentEvent({ user, subscription, event, now: new Date() });

			await this.subscriptionActionExecutor.execute({
				action,
				trx,
			});
		});
	}

	private extractMetadata(metadata?: Record<string, unknown>): EventMetadata | undefined {
		if (!metadata) {
			return undefined;
		}

		const userId = this.pickString(metadata, ['user_id', 'userId']);
		const subscriptionId = this.pickString(metadata, ['subscription_id', 'subscriptionId']);

		if (!userId || !subscriptionId) {
			return undefined;
		}

		return { userId, subscriptionId };
	}

	private pickString(source: Record<string, unknown>, keys: string[]): string | undefined {
		for (const key of keys) {
			const value = source[key];
			if (typeof value === 'string' && value.length > 0) {
				return value;
			}
		}
		return undefined;
	}

	private buildEvent(payload: YookassaWebhookPayload): WebhookEvent {
		const base = payload.object;
		switch (payload.event) {
			case 'payment_method.active': {
				const occurredAt = this.parseDate(base.created_at);
				const paymentMethodId = base.id;
				return { type: 'payment_method.active', paymentMethodId, occurredAt };
			}
			case 'payment.succeeded': {
				const occurredAt = this.parseDate(base.created_at);
				return { type: 'payment.succeeded', occurredAt };
			}
			case 'payment.canceled': {
				const occurredAt = this.parseDate(base.created_at);
				return { type: 'payment.canceled', occurredAt };
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
