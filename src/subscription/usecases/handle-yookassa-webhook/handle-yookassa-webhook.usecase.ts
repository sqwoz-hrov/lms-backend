import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { Switch } from '../../../common/utils/safe-guard';
import { SubscriptionManagerFactory } from '../../domain/subscription-manager.factory';
import { SubscriptionActionExecutor } from '../../services/subscription-action.executor';
import { SubscriptionRepository } from '../../subscription.repository';
import {
	EventMetadata,
	PaymentWebhookEvent,
	SUPPORTED_EVENTS,
	YookassaWebhookPayload,
} from '../../types/yookassa-webhook';

@Injectable()
export class HandleYookassaWebhookUsecase implements UsecaseInterface {
	private readonly logger = new Logger(HandleYookassaWebhookUsecase.name);

	constructor(
		private readonly subscriptionRepository: SubscriptionRepository,
		private readonly subscriptionManagerFactory: SubscriptionManagerFactory,
		private readonly subscriptionActionExecutor: SubscriptionActionExecutor,
	) {}

	async execute(payload: YookassaWebhookPayload): Promise<void> {
		await this.subscriptionRepository.transaction(async trx => {
			let userId: string | null = null;
			let subscriptionId: string | null = null;

			try {
				const metadata = payload.object.metadata;

				if (!this.metadataIsValid(metadata)) {
					this.logger.error(`Webhook ${payload.event} missing subscription metadata, skipping`);

					throw new Error();
				}

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

					throw new Error();
				}

				userId = user.id;

				const subscription = await this.subscriptionRepository.lockByUserId(metadata.user_id, trx);

				if (!subscription) {
					this.logger.warn(`Subscription for user_id ${metadata.user_id} not found for webhook ${payload.event}`);

					throw new Error();
				}

				subscriptionId = subscription.id;

				if (!SUPPORTED_EVENTS.has(payload.event)) {
					this.logger.debug(`Ignoring unsupported event ${payload.event}`);

					throw new Error();
				}

				if (metadata.user_id !== subscription.user_id) {
					this.logger.warn(
						`Webhook metadata user ${metadata.user_id} does not match subscription owner ${subscription.user_id}`,
					);
				}

				const event = this.buildEvent(payload);
				if (!event) {
					this.logger.warn(`Failed to build event payload for ${payload.event}`);
					return;
				}

				if (event.paymentMethod) {
					await this.subscriptionRepository.upsertPaymentMethod(
						{
							user_id: subscription.user_id,
							payment_method_id: event.paymentMethod.id,
						},
						trx,
					);
				}

				const { action } = manager.handlePaymentEvent({ user, subscription, event });

				await this.subscriptionActionExecutor.execute({
					action,
					trx,
				});

				await this.subscriptionRepository.insertPaymentEvent({
					user_id: user.id,
					subscription_id: subscription.id,
					event: payload,
				});
			} catch {
				await this.subscriptionRepository.insertPaymentEvent({
					user_id: userId,
					subscription_id: subscriptionId,
					event: payload,
				});
			}
		});
	}

	private buildEvent(payload: YookassaWebhookPayload): PaymentWebhookEvent {
		const base = payload.object;
		switch (payload.event) {
			case 'payment.succeeded': {
				const occurredAt = this.parseDate(base.created_at);

				if (!this.metadataIsValid(base.metadata)) throw new InternalServerErrorException('metadata is not valid');

				return { type: 'payment.succeeded', meta: base.metadata, paymentMethod: base.payment_method, occurredAt };
			}
			case 'payment.canceled': {
				const occurredAt = this.parseDate(base.created_at);

				if (!this.metadataIsValid(base.metadata)) throw new InternalServerErrorException('metadata is not valid');

				return { type: 'payment.canceled', meta: base.metadata, paymentMethod: base.payment_method, occurredAt };
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

	private metadataIsValid(metadata: Record<string, unknown> | undefined): metadata is EventMetadata {
		return typeof metadata?.user_id === 'string' && typeof metadata.subscription_tier_id === 'string';
	}
}
