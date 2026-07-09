import { Injectable, Logger } from '@nestjs/common';
import { Switch } from '../../../../common/utils/safe-guard';
import { SubscriptionRepository } from '../../../subscription.repository';
import { EventMetadata, PaymentWebhookEvent } from '../../../types/yookassa-webhook';
import { PaymentWebhookPayload, WebhookRouteParams } from './webhook-router';
import { SubscriptionStateService } from '../../../domain/subscription.state';
import { GiftRepository } from '../../../../gift/gift.repository';

@Injectable()
export class PaymentWebhookHandlerStrategy {
	private readonly logger = new Logger(PaymentWebhookHandlerStrategy.name);

	constructor(
		private readonly subscriptionRepository: SubscriptionRepository,
		private readonly subscriptionStateService: SubscriptionStateService,
		private readonly giftRepository: GiftRepository,
	) {}

	// TODO: use Date.now instead of occured at to determine subscription new period end: when we experience downtime of 6 hours, sub will not get less experience
	async handle({ payload, trx, context }: WebhookRouteParams<PaymentWebhookPayload>): Promise<void> {
		const metadata = payload.object.metadata;

		if (!metadata) {
			this.logger.error(`Webhook ${payload.event} missing subscription metadata, skipping`);
			throw new Error('Invalid metadata');
		}

		context.userId = metadata.user_id;

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

		const paidAndGiftedSubObject = await this.subscriptionRepository.lockSubscriptionByUserId(metadata.user_id, trx);

		if (!paidAndGiftedSubObject) {
			this.logger.warn(`Subscription for user_id ${metadata.user_id} not found for webhook ${payload.event}`);
			throw new Error('Subscription not found');
		}

		const { currentPaidSubscription, currentActiveGiftSubscription } = paidAndGiftedSubObject;

		context.subscriptionId = currentPaidSubscription.subscription.id;

		if (metadata.user_id !== currentPaidSubscription.subscription.user_id) {
			this.logger.warn(
				`Webhook metadata user ${metadata.user_id} does not match subscription owner ${currentPaidSubscription.subscription.user_id}`
			);
		}

		const event = this.buildEvent(payload, metadata);
		if (!event) {
			this.logger.warn(`Failed to build event payload for ${payload.event}`);
			return;
		}

		// TODO: obtain from webhook
		const targetTier = await this.subscriptionRepository.getTierById(event.meta.current_tier_id, trx);

		// TODO: cache
		const freeTier = await this.subscriptionRepository.getFreeTier(trx);

		const { newSub, newGift } = this.subscriptionStateService.handlePaymentEvent({
			user,
			subscription: paidAndGiftedSubObject,
			event: {
				...event,
				meta: {
					...event.meta,
					targetTierPower: targetTier.power,
					paidAmount: payload.object.amount,
				},
			},
			freeTier
		});

		await this.subscriptionRepository.update(currentPaidSubscription.subscription.id, {
			...newSub,
		}, trx);

		if (newGift && currentActiveGiftSubscription && newGift.duration_days > 0) {
			await this.giftRepository.resetGift(currentActiveGiftSubscription.gift.giftId, {
				...newGift,
			}, trx);
		}
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
