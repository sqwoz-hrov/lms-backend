import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { subscriptionBillingConfig } from '../../config/subscription-billing.config';
import { YOOKASSA_CLIENT } from '../../yookassa/constants';
import { YookassaClientPort } from '../../yookassa/services/yookassa-client.interface';
import { Subscription } from '../subscription.entity';
import { BillableSubscriptionRow, SubscriptionRepository } from '../subscription.repository';

type BillingOutcome = 'charged' | 'skipped' | 'failed';

const MS_IN_DAY = 24 * 60 * 60 * 1000;

export interface BillingRunSummary {
	processed: number;
	charged: number;
	skipped: number;
	failed: number;
}

@Injectable()
export class SubscriptionBillingService {
	private readonly logger = new Logger(SubscriptionBillingService.name);

	constructor(
		private readonly subscriptionRepository: SubscriptionRepository,
		@Inject(YOOKASSA_CLIENT) private readonly yookassaClient: YookassaClientPort,
		@Inject(subscriptionBillingConfig.KEY) private readonly config: ConfigType<typeof subscriptionBillingConfig>,
	) {}

	async runBillingCycle(now = new Date()): Promise<BillingRunSummary> {
		const summary: BillingRunSummary = {
			processed: 0,
			charged: 0,
			skipped: 0,
			failed: 0,
		};

		if (!this.config.enabled) {
			this.logger.debug('Subscription billing disabled, skipping run');
			return summary;
		}

		while (true) {
			const candidates = await this.subscriptionRepository.findBillableSubscriptions({
				runDate: now,
				leadTimeDays: this.config.leadDays,
				retryWindowDays: this.config.retryWindowDays,
				limit: this.config.batchSize,
			});

			if (candidates.length === 0) {
				break;
			}

			for (const candidate of candidates) {
				summary.processed += 1;
				const outcome = await this.handleCandidate(candidate, now);
				switch (outcome) {
					case 'charged':
						summary.charged += 1;
						break;
					case 'failed':
						summary.failed += 1;
						break;
					default:
						summary.skipped += 1;
				}
			}

			if (candidates.length < this.config.batchSize) {
				break;
			}
		}

		return summary;
	}

	private async handleCandidate(candidate: BillableSubscriptionRow, runDate: Date): Promise<BillingOutcome> {
		const attemptId = randomUUID();
		const attemptTime = new Date();

		const prepared = await this.subscriptionRepository.transaction(async trx => {
			const locked = await this.subscriptionRepository.lockByUserId(candidate.user_id, trx);
			if (!locked) {
				return { status: 'skip', reason: 'subscription-missing' } as const;
			}

			if (!this.isSubscriptionBillableNow(locked, runDate)) {
				return { status: 'skip', reason: 'not-due' } as const;
			}

			await this.subscriptionRepository.update(
				locked.id,
				{
					last_billing_attempt: attemptTime,
				},
				trx,
			);

			await this.subscriptionRepository.insertPaymentEvent(
				{
					user_id: locked.user_id,
					subscription_id: locked.id,
					event: {
						type: 'billing.attempt',
						attemptId,
						scheduled_for: runDate.toISOString(),
						attempted_at: attemptTime.toISOString(),
						payment_method_id: candidate.billing_payment_method_id,
						amount_rubles: locked.price_on_purchase_rubles,
					},
				},
				trx,
			);

			return { status: 'ready', subscription: locked } as const;
		});

		if (prepared.status !== 'ready') {
			this.logger.debug(`Skipping billing for subscription ${candidate.id}: ${prepared.reason ?? 'unknown reason'}`);
			return 'skipped';
		}

		try {
			const payment = await this.yookassaClient.chargeSavedPaymentMethod({
				amountRubles: prepared.subscription.price_on_purchase_rubles,
				description: this.config.description,
				paymentMethodId: candidate.billing_payment_method_id,
				idempotenceKey: `subscription-billing-${prepared.subscription.id}-${attemptId}`,
				metadata: {
					user_id: prepared.subscription.user_id,
					subscription_tier_id: prepared.subscription.subscription_tier_id,
				},
			});

			await this.subscriptionRepository.insertPaymentEvent({
				user_id: prepared.subscription.user_id,
				subscription_id: prepared.subscription.id,
				event: {
					type: 'billing.success',
					attemptId,
					payment_id: payment.id,
					occurredAt: payment.created_at,
					attempted_at: attemptTime.toISOString(),
				},
			});

			return 'charged';
		} catch (error) {
			const err = error instanceof Error ? error : new Error('Unknown billing failure');
			this.logger.error(
				`Failed to charge subscription ${prepared.subscription.id} with payment method ${candidate.billing_payment_method_id}: ${err.message}`,
				err.stack,
			);

			await this.subscriptionRepository.insertPaymentEvent({
				user_id: prepared.subscription.user_id,
				subscription_id: prepared.subscription.id,
				event: {
					type: 'billing.failure',
					attemptId,
					error: err.message,
					attempted_at: attemptTime.toISOString(),
				},
			});

			return 'failed';
		}
	}

	private isSubscriptionBillableNow(subscription: Subscription, runDate: Date): boolean {
		if (subscription.is_gifted) {
			return false;
		}

		if (!subscription.billing_period_days || subscription.billing_period_days <= 0) {
			return false;
		}

		const chargeBefore = new Date(runDate.getTime() + this.config.leadDays * MS_IN_DAY);
		const retryAfter = new Date(runDate.getTime() - this.config.retryWindowDays * MS_IN_DAY);

		const periodDue = subscription.current_period_end == null || subscription.current_period_end <= chargeBefore;

		const retryDue = subscription.last_billing_attempt == null || subscription.last_billing_attempt <= retryAfter;

		return periodDue && retryDue;
	}
}
