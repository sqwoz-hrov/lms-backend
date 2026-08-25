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
		this.logger.log(`Handling payment webhook event=${payload.event} paymentId=${payload.object.id}`);
		const metadata = payload.object.metadata;

		if (!metadata) {
			this.logger.error(`Webhook ${payload.event} missing subscription metadata, skipping`);
			throw new Error('Invalid metadata');
		}

		context.userId = metadata.user_id;
		this.logger.debug(
			`Payment webhook metadata resolved event=${payload.event} paymentId=${payload.object.id} userId=${metadata.user_id} targetTierId=${metadata.current_tier_id}`,
		);

		this.logger.debug(`Locking user for payment webhook userId=${metadata.user_id}`);
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
		this.logger.debug(`User locked for payment webhook userId=${metadata.user_id}`);

		this.logger.debug(`Locking subscription for payment webhook userId=${metadata.user_id}`);
		const paidAndGiftedSubObject = await this.subscriptionRepository.lockSubscriptionByUserId(metadata.user_id, trx);

		if (!paidAndGiftedSubObject) {
			this.logger.warn(`Subscription for user_id ${metadata.user_id} not found for webhook ${payload.event}`);
			throw new Error('Subscription not found');
		}

		const { currentPaidSubscription, currentActiveGiftSubscription } = paidAndGiftedSubObject;

		context.subscriptionId = currentPaidSubscription.subscription.id;
		this.logger.debug(
			`Subscription locked for payment webhook subscriptionId=${context.subscriptionId} userId=${metadata.user_id}`,
		);

		if (metadata.user_id !== currentPaidSubscription.subscription.user_id) {
			this.logger.warn(
				`Webhook metadata user ${metadata.user_id} does not match subscription owner ${currentPaidSubscription.subscription.user_id}`,
			);
		}

		const event = this.buildEvent(payload, metadata);
		if (!event) {
			this.logger.warn(`Failed to build event payload for ${payload.event}`);
			return;
		}
		this.logger.debug(
			`Payment domain event built type=${event.type} subscriptionId=${context.subscriptionId} occurredAt=${event.occurredAt.toISOString()}`,
		);

		// TODO: obtain from webhook
		this.logger.debug(`Loading target tier for payment webhook tierId=${event.meta.current_tier_id}`);
		const targetTier = await this.subscriptionRepository.getTierById(event.meta.current_tier_id, trx);

		// TODO: cache
		this.logger.debug('Loading free tier for payment webhook');
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
			freeTier,
		});
		this.logger.debug(
			`Payment state transition calculated event=${event.type} subscriptionId=${context.subscriptionId} hasGiftUpdate=${Boolean(newGift)}`,
		);

		await this.subscriptionRepository.update(
			currentPaidSubscription.subscription.id,
			{
				...newSub,
			},
			trx,
		);
		this.logger.log(
			`Subscription updated from payment webhook event=${event.type} subscriptionId=${context.subscriptionId} userId=${metadata.user_id}`,
		);

		if (newGift && currentActiveGiftSubscription && newGift.duration_days > 0) {
			this.logger.debug(
				`Resetting active gift from payment webhook subscriptionId=${context.subscriptionId} giftId=${currentActiveGiftSubscription.gift.giftId}`,
			);
			await this.giftRepository.resetGift(
				currentActiveGiftSubscription.gift.giftId,
				{
					...newGift,
				},
				trx,
			);
			this.logger.log(
				`Active gift reset from payment webhook subscriptionId=${context.subscriptionId} giftId=${currentActiveGiftSubscription.gift.giftId}`,
			);
		}

		this.logger.log(
			`Payment webhook processed event=${event.type} paymentId=${payload.object.id} subscriptionId=${context.subscriptionId} userId=${metadata.user_id}`,
		);
	}

	private buildEvent(payload: PaymentWebhookPayload, metadata: EventMetadata): PaymentWebhookEvent {
		this.logger.debug(
			`Building payment domain event webhookEvent=${payload.event} paymentId=${payload.object.id} userId=${metadata.user_id}`,
		);
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
		this.logger.debug(`Parsing payment webhook date input=${input ?? 'missing'}`);
		if (input === undefined) {
			const fallback = new Date();
			this.logger.warn(`Payment webhook date missing; using current time=${fallback.toISOString()}`);
			return fallback;
		}
		const parsed = new Date(input);
		if (Number.isNaN(parsed.getTime())) {
			this.logger.error(`Invalid payment webhook date input=${input}`);
			throw new Error('Invalid payment webhook date');
		}
		this.logger.debug(`Parsed payment webhook date value=${parsed.toISOString()}`);
		return parsed;
	}
}
