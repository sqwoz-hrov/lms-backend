import { Injectable, Logger } from '@nestjs/common';
import { SubscriptionRepository } from '../subscription.repository';
import { YookassaPaymentMethodActiveWebhook } from '../types/yookassa-webhook';
import { WebhookRouteParams } from './webhook-router';

@Injectable()
export class PaymentMethodWebhookHandler {
	private readonly logger = new Logger(PaymentMethodWebhookHandler.name);

	constructor(private readonly subscriptionRepository: SubscriptionRepository) {}

	async handle({ payload, trx, context }: WebhookRouteParams<YookassaPaymentMethodActiveWebhook>): Promise<void> {
		const paymentMethod = await this.subscriptionRepository.findPaymentMethodByPaymentMethodId(payload.object.id, trx);

		if (!paymentMethod) {
			this.logger.warn(`Payment method ${payload.object.id} not found for webhook ${payload.event}`);
			throw new Error('Payment method not found');
		}

		context.userId = paymentMethod.user_id;
		context.subscriptionId = null;

		if (payload.object.status !== 'active') {
			this.logger.warn(
				`Received payment_method.active webhook with non-active status "${payload.object.status}" for method ${payload.object.id}`,
			);
			return;
		}

		if (paymentMethod.status === 'active') {
			return;
		}

		await this.subscriptionRepository.updatePaymentMethodStatus(payload.object.id, 'active', trx);
		await this.subscriptionRepository.deletePaymentMethodsExcept(paymentMethod.user_id, payload.object.id, trx, {
			status: 'active',
		});
	}
}
