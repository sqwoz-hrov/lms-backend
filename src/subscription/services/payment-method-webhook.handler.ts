import { Injectable, Logger } from '@nestjs/common';
import { SubscriptionRepository } from '../subscription.repository';
import { YookassaPaymentMethodActiveWebhook } from '../types/yookassa-webhook';
import { WebhookRouteParams } from './webhook-router';

@Injectable()
export class PaymentMethodWebhookHandler {
	private readonly logger = new Logger(PaymentMethodWebhookHandler.name);

	constructor(private readonly subscriptionRepository: SubscriptionRepository) {}

	async handle({ payload, trx, context }: WebhookRouteParams<YookassaPaymentMethodActiveWebhook>): Promise<void> {
		const metadata = payload.object.metadata;

		if (!metadata) {
			this.logger.error(`Webhook ${payload.event} missing user metadata, skipping`);
			throw new Error('Invalid metadata');
		}

		context.userId = metadata.user_id;
		context.subscriptionId = null;

		const user = await trx
			.selectFrom('user')
			.selectAll()
			.where('id', '=', metadata.user_id)
			.limit(1)
			.executeTakeFirst();

		if (!user) {
			this.logger.warn(`User ${metadata.user_id} not found for webhook ${payload.event}`);
			throw new Error('User not found');
		}

		await this.subscriptionRepository.upsertPaymentMethod(
			{
				user_id: metadata.user_id,
				payment_method_id: payload.object.id,
			},
			trx,
		);
	}
}
