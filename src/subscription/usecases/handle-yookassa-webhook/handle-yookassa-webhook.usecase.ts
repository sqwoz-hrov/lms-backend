import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
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

		const metadata = payload.object.metadata;
		if (!this.metadataIsValid(metadata)) {
			this.logger.warn(`Webhook ${payload.event} missing subscription metadata, skipping`);
			return;
		}

		const manager = await this.subscriptionManagerFactory.create();

		await this.subscriptionRepository.transaction(async trx => {
			const user = await trx
				.selectFrom('user')
				.selectAll()
				.where('id', '=', metadata.user_id)
				.forUpdate()
				.limit(1)
				.executeTakeFirst();

			if (!user) {
				this.logger.warn(`User ${metadata.user_id} not found for webhook ${payload.event}`);
				return;
			}

			const subscription = await this.subscriptionRepository.lockByUserId(metadata.user_id, trx);
			if (!subscription) {
				this.logger.warn(`Subscription for user_id ${metadata.user_id} not found for webhook ${payload.event}`);
				return;
			}

			if (metadata.user_id !== subscription.user_id) {
				this.logger.warn(
					`Webhook metadata user ${metadata.user_id} does not match subscription owner ${subscription.user_id}`,
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

				if (!this.metadataIsValid(base.metadata)) throw new InternalServerErrorException('metadata is not valid');

				return { type: 'payment.succeeded', meta: base.metadata, occurredAt };
			}
			case 'payment.canceled': {
				const occurredAt = this.parseDate(base.created_at);

				if (!this.metadataIsValid(base.metadata)) throw new InternalServerErrorException('metadata is not valid');

				return { type: 'payment.canceled', meta: base.metadata, occurredAt };
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
