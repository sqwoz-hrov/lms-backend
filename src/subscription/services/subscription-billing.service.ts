import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { subscriptionBillingConfig } from '../../config/subscription-billing.config';
import { YOOKASSA_CLIENT } from '../../yookassa/constants';
import { YookassaClientPort } from '../../yookassa/services/yookassa-client.interface';
import { BillableSubscriptionRow } from '../subscription.repository';
import { Switch } from '../../common/utils/safe-guard';
import { SUBSCRIPTION_REPOSITORY_PORT, BillingEventType } from '../constants';
import { Subscription } from '../subscription.entity';
import { isDueNow } from '../utils/is-due-now';
import {
	BillableSubscriptionCursor,
	SubscriptionRepositoryPort,
	SubscriptionRepositoryPortTransaction,
} from '../ports/subscription-repository.port';

type BillingOutcome = 'charged' | 'skipped' | 'failed';

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
		@Inject(SUBSCRIPTION_REPOSITORY_PORT)
		private readonly subscriptionRepository: SubscriptionRepositoryPort,
		@Inject(YOOKASSA_CLIENT) private readonly yookassaClient: YookassaClientPort,
		@Inject(subscriptionBillingConfig.KEY) private readonly config: ConfigType<typeof subscriptionBillingConfig>,
	) {}

	async runBillingCycle(params?: { now?: Date; signal?: AbortSignal }): Promise<BillingRunSummary> {
		const runDate = params?.now ?? new Date();
		const signal = params?.signal ?? new AbortController().signal;
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

		if (signal.aborted) {
			this.logger.warn('Subscription billing run aborted before it could start');
			return summary;
		}

		for await (const candidate of this.fetchBillableSubscriptions({ runDate, signal })) {
			if (signal.aborted) {
				this.logger.warn('Subscription billing run aborted, stopping processing loop');
				break;
			}

			summary.processed += 1;
			const outcome = await this.handleCandidate(candidate, runDate);
			switch (outcome) {
				case 'charged':
					summary.charged += 1;
					break;
				case 'failed':
					summary.failed += 1;
					break;
				case 'skipped':
					summary.skipped += 1;
					break;
				default:
					Switch.safeGuard(outcome);
					break;
			}
		}

		return summary;
	}

	private async handleCandidate(candidate: BillableSubscriptionRow, runDate: Date): Promise<BillingOutcome> {
		const context: BillingAttemptContext = {
			attemptId: randomUUID(),
			attemptTime: new Date(),
			runDate,
			paymentMethodId: candidate.billing_payment_method_id,
		};

		const prepared = await this.prepareAttempt(candidate, context);

		if (prepared.status !== 'ready') {
			this.logger.debug(`Skipping billing for subscription ${candidate.id}: ${prepared.reason ?? 'unknown reason'}`);
			return 'skipped';
		}

		try {
			const payment = await this.yookassaClient.chargeSavedPaymentMethod({
				amountRubles: prepared.subscription.price_on_purchase_rubles,
				description: this.config.description,
				paymentMethodId: candidate.billing_payment_method_id,
				idempotenceKey: `subscription-billing-${prepared.subscription.id}-${context.attemptId}`,
				metadata: {
					user_id: prepared.subscription.user_id,
					subscription_tier_id: prepared.subscription.subscription_tier_id,
				},
			});

			await this.recordSuccess(prepared.subscription, context, payment);

			return 'charged';
		} catch (error) {
			const err = error instanceof Error ? error : new Error('Unknown billing failure');
			this.logger.error(
				`Failed to charge subscription ${prepared.subscription.id} with payment method ${candidate.billing_payment_method_id}: ${err.message}`,
				err.stack,
			);

			await this.recordFailure(prepared.subscription, context, err.message);

			return 'failed';
		}
	}

	private async *fetchBillableSubscriptions(params: {
		runDate: Date;
		signal: AbortSignal;
	}): AsyncGenerator<BillableSubscriptionRow> {
		const { runDate, signal } = params;
		let cursor: BillableSubscriptionCursor | undefined;
		const seenSubscriptions = new Set<string>();

		while (!signal.aborted) {
			const batch = await this.subscriptionRepository.findBillableSubscriptions({
				runDate,
				retryWindowDays: this.config.retryWindowDays,
				limit: this.config.batchSize,
				cursor,
			});

			if (signal.aborted || batch.length === 0) {
				return;
			}

			for (const candidate of batch) {
				if (signal.aborted) {
					return;
				}

				if (seenSubscriptions.has(candidate.id)) {
					continue;
				}

				seenSubscriptions.add(candidate.id);
				yield candidate;
			}

			const lastCandidate = batch[batch.length - 1];
			if (lastCandidate) {
				cursor = {
					id: lastCandidate.id,
					currentPeriodEnd: lastCandidate.current_period_end,
				};
			}

			if (batch.length < this.config.batchSize) {
				return;
			}
		}
	}

	private async prepareAttempt(
		candidate: BillableSubscriptionRow,
		context: BillingAttemptContext,
	): Promise<PreparedBillingAttempt> {
		return await this.subscriptionRepository.transaction(async (trx: SubscriptionRepositoryPortTransaction) => {
			const locked = await this.subscriptionRepository.lockByUserId(candidate.user_id, trx);
			if (!locked) {
				return { status: 'skip', reason: 'subscription-missing' } as const;
			}

			if (!isDueNow(locked, context.runDate, this.config.retryWindowDays)) {
				return { status: 'skip', reason: 'not-due' } as const;
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
						type: BillingEventType.ATTEMPT_PREPARED,
						attemptId: context.attemptId,
						scheduled_for: context.runDate.toISOString(),
						attempted_at: context.attemptTime.toISOString(),
						payment_method_id: context.paymentMethodId,
						amount_rubles: locked.price_on_purchase_rubles,
					},
				},
				trx,
			);

			return { status: 'ready', subscription: locked } as const;
		});
	}

	private async recordSuccess(
		subscription: Subscription,
		context: BillingAttemptContext,
		payment: PaymentRecord,
	): Promise<void> {
		await this.subscriptionRepository.insertPaymentEvent({
			user_id: subscription.user_id,
			subscription_id: subscription.id,
			event: {
				type: BillingEventType.CHARGE_REQUESTED,
				attemptId: context.attemptId,
				payment_id: payment.id,
				occurredAt: payment.created_at,
				attempted_at: context.attemptTime.toISOString(),
			},
		});
	}

	private async recordFailure(
		subscription: Subscription,
		context: BillingAttemptContext,
		error: string,
	): Promise<void> {
		await this.subscriptionRepository.insertPaymentEvent({
			user_id: subscription.user_id,
			subscription_id: subscription.id,
			event: {
				type: BillingEventType.CHARGE_REQUEST_FAILED,
				attemptId: context.attemptId,
				error,
				attempted_at: context.attemptTime.toISOString(),
			},
		});
	}
}

type PreparedBillingAttempt =
	| { status: 'ready'; subscription: Subscription }
	| { status: 'skip'; reason: 'subscription-missing' | 'not-due' };

type BillingAttemptContext = {
	attemptId: string;
	attemptTime: Date;
	runDate: Date;
	paymentMethodId: string;
};

type PaymentRecord = {
	id: string;
	created_at: string;
};
