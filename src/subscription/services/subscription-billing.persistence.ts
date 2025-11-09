import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { subscriptionBillingConfig } from '../../config/subscription-billing.config';
import { Subscription } from '../subscription.entity';
import { BillableSubscriptionRow, SubscriptionRepository } from '../subscription.repository';
import {
	BillingAttemptContext,
	BillingPaymentRecord,
	BillingPersistencePort,
	PreparedBillingAttempt,
} from '../ports/billing-persistence';
import { isDueNow } from '../utils/is-due-now';

@Injectable()
export class SubscriptionBillingPersistence implements BillingPersistencePort {
	constructor(
		private readonly subscriptionRepository: SubscriptionRepository,
		@Inject(subscriptionBillingConfig.KEY) private readonly config: ConfigType<typeof subscriptionBillingConfig>,
	) {}

	async fetchBillableSubscriptions(params: { runDate: Date; limit: number }): Promise<BillableSubscriptionRow[]> {
		return await this.subscriptionRepository.findBillableSubscriptions({
			runDate: params.runDate,
			retryWindowDays: this.config.retryWindowDays,
			limit: params.limit,
		});
	}

	async prepareAttempt(
		candidate: BillableSubscriptionRow,
		context: BillingAttemptContext,
	): Promise<PreparedBillingAttempt> {
		return await this.subscriptionRepository.transaction(async trx => {
			const locked = await this.subscriptionRepository.lockByUserId(candidate.user_id, trx);
			if (!locked) {
				return { status: 'skip', reason: 'subscription-missing' };
			}

			if (!isDueNow(locked, context.runDate, this.config.retryWindowDays)) {
				return { status: 'skip', reason: 'not-due' };
			}

			await this.subscriptionRepository.update(
				locked.id,
				{
					last_billing_attempt: context.attemptTime,
				},
				trx,
			);

			await this.subscriptionRepository.insertPaymentEvent(
				{
					user_id: locked.user_id,
					subscription_id: locked.id,
					event: {
						type: 'billing.attempt',
						attemptId: context.attemptId,
						scheduled_for: context.runDate.toISOString(),
						attempted_at: context.attemptTime.toISOString(),
						payment_method_id: context.paymentMethodId,
						amount_rubles: locked.price_on_purchase_rubles,
					},
				},
				trx,
			);

			return { status: 'ready', subscription: locked };
		});
	}

	async recordSuccess(params: {
		subscription: Subscription;
		context: BillingAttemptContext;
		payment: BillingPaymentRecord;
	}): Promise<void> {
		await this.subscriptionRepository.insertPaymentEvent({
			user_id: params.subscription.user_id,
			subscription_id: params.subscription.id,
			event: {
				type: 'billing.success',
				attemptId: params.context.attemptId,
				payment_id: params.payment.id,
				occurredAt: params.payment.created_at,
				attempted_at: params.context.attemptTime.toISOString(),
			},
		});
	}

	async recordFailure(params: {
		subscription: Subscription;
		context: BillingAttemptContext;
		error: string;
	}): Promise<void> {
		await this.subscriptionRepository.insertPaymentEvent({
			user_id: params.subscription.user_id,
			subscription_id: params.subscription.id,
			event: {
				type: 'billing.failure',
				attemptId: params.context.attemptId,
				error: params.error,
				attempted_at: params.context.attemptTime.toISOString(),
			},
		});
	}
}
