import { Injectable, Logger } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { SubscriptionRepository } from '../../subscription.repository';
import { WebhookRouteContext, YookassaWebhookRouter } from './strategies/webhook-router';
import { SUPPORTED_EVENTS } from '../../types/yookassa-webhook';

const SUPPORTED_EVENTS_SET = new Set<string>(SUPPORTED_EVENTS);

type SupportedWebhookDedupeKey = {
	event: string;
	objectId: string;
};

@Injectable()
export class HandleYookassaWebhookUsecase implements UsecaseInterface {
	private readonly logger = new Logger(HandleYookassaWebhookUsecase.name);

	constructor(
		private readonly subscriptionRepository: SubscriptionRepository,
		private readonly webhookRouter: YookassaWebhookRouter,
	) {}

	async execute(payload: unknown): Promise<void> {
		await this.subscriptionRepository.transaction(async trx => {
			const context: WebhookRouteContext = { userId: null, subscriptionId: null };
			const dedupeKeyOrNull = this.getSupportedWebhookDedupeKey(payload);

			if (dedupeKeyOrNull) {
				// TODO: also should check the order and determine behavior for say cancel => success, but cancel comes after success (even though occuredAt is prior to success' occuredAt)
				const existingEvent = await this.subscriptionRepository.findPaymentEventByYookassaWebhookDedupeKey(
					dedupeKeyOrNull,
					trx,
				);

				if (existingEvent) {
					this.logger.warn(
						`Duplicate YooKassa webhook delivery skipped: ${dedupeKeyOrNull.event} for object ${dedupeKeyOrNull.objectId}`,
					);
					return;
				}
			}

			try {
				await this.webhookRouter.route({
					payload,
					trx,
					context,
				});
			} catch (error) {
				this.logger.error(
					`Failed to process webhook ${(payload as any).event}`,
					error instanceof Error ? error.stack : undefined,
				);
			} finally {
				if (dedupeKeyOrNull) {
					await this.subscriptionRepository.insertPaymentEventOnYookassaWebhookConflictDoNothing(
						{
							user_id: context.userId,
							subscription_id: context.subscriptionId,
							event: payload,
						},
						trx,
					);
				} else {
					await this.subscriptionRepository.insertPaymentEvent(
						{
							user_id: context.userId,
							subscription_id: context.subscriptionId,
							event: payload,
						},
						trx,
					);
				}
			}
		});
	}

	private getSupportedWebhookDedupeKey(payload: unknown): SupportedWebhookDedupeKey | null {
		if (payload === null || typeof payload !== 'object') {
			return null;
		}

		const event = (payload as { event?: unknown }).event;
		if (typeof event !== 'string' || !SUPPORTED_EVENTS_SET.has(event)) {
			return null;
		}

		const object = (payload as { object?: unknown }).object;
		if (object === null || typeof object !== 'object') {
			return null;
		}

		const objectId = (object as { id?: unknown }).id;
		if (typeof objectId !== 'string') {
			return null;
		}

		return { event, objectId };
	}
}
