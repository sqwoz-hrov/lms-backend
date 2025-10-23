import { Injectable, Logger } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { SubscriptionRepository } from '../../subscription.repository';
import { SubscriptionManagerFactory } from '../../domain/subscription-manager.factory';
import { SubscriptionActionExecutor } from '../../services/subscription-action.executor';

interface YookassaWebhookPayload {
	event: string;
	object?: {
		id?: string;
		metadata?: Record<string, unknown>;
		payment_method?: {
			id?: string;
		};
		captured_at?: string;
		created_at?: string;
		canceled_at?: string;
	};
}

interface EventMetadata {
	userId: string;
	subscriptionId: string;
}

const SUPPORTED_EVENTS = new Set(['payment.succeeded', 'payment.canceled', 'payment_method.active']);

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

	private buildEvent(payload: YookassaWebhookPayload) {
		const base = payload.object ?? {};
		switch (payload.event) {
			case 'payment_method.active': {
				const paymentMethodId = base.payment_method?.id ?? base.id;
				if (!paymentMethodId) {
					return undefined;
				}
				return { type: 'payment_method.active', paymentMethodId } as const;
			}
			case 'payment.succeeded': {
				const occurredAt = this.parseDate(base.captured_at ?? base.created_at);
				return { type: 'payment.succeeded', occurredAt } as const;
			}
			case 'payment.canceled': {
				const occurredAt = this.parseDate(base.canceled_at ?? base.created_at);
				return { type: 'payment.canceled', occurredAt } as const;
			}
			default:
				return undefined;
		}
	}

	private parseDate(input?: string): Date | undefined {
		if (!input) {
			return undefined;
		}
		const parsed = new Date(input);
		return Number.isNaN(parsed.getTime()) ? undefined : parsed;
	}
}
