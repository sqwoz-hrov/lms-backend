import { Injectable, Logger } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { SubscriptionRepository } from '../../subscription.repository';
import { WebhookRouteContext, YookassaWebhookRouter } from '../../services/webhook-router';

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
				await this.subscriptionRepository.insertPaymentEvent({
					user_id: context.userId,
					subscription_id: context.subscriptionId,
					event: payload,
				});
			}
		});
	}
}
