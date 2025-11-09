import { Inject, Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { subscriptionBillingConfig } from '../../config/subscription-billing.config';
import { YOOKASSA_CLIENT } from '../../yookassa/constants';
import { YookassaClientPort } from '../../yookassa/services/yookassa-client.interface';
import { BillableSubscriptionRow } from '../subscription.repository';
import { BillingAttemptContext, BillingPersistencePort } from '../ports/billing-persistence';
import { Switch } from '../../common/utils/safe-guard';
import { BILLING_PERSISTENCE } from '../constants';

type BillingOutcome = 'charged' | 'skipped' | 'failed';

export interface BillingRunSummary {
	processed: number;
	charged: number;
	skipped: number;
	failed: number;
}

@Injectable()
export class SubscriptionBillingService implements OnApplicationShutdown {
	private readonly logger = new Logger(SubscriptionBillingService.name);
	private activeRunController?: AbortController;

	constructor(
		@Inject(BILLING_PERSISTENCE) private readonly billingPersistence: BillingPersistencePort,
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

		const controller = new AbortController();
		this.setActiveRunController(controller);

		try {
			for await (const candidate of this.billingPersistence.fetchBillableSubscriptions({
				runDate: now,
				limit: this.config.batchSize,
				signal: controller.signal,
			})) {
				if (controller.signal.aborted) {
					this.logger.warn('Subscription billing run aborted, stopping processing loop');
					break;
				}

				summary.processed += 1;
				const outcome = await this.handleCandidate(candidate, now);
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
		} finally {
			this.clearActiveRunController(controller);
		}

		return summary;
	}

	onApplicationShutdown(signal?: string): void {
		if (this.activeRunController && !this.activeRunController.signal.aborted) {
			const extra = signal ? ` (${signal})` : '';
			this.logger.warn(`Aborting subscription billing run due to application shutdown${extra}`);
			this.activeRunController.abort();
		}
	}

	private setActiveRunController(controller: AbortController): void {
		if (this.activeRunController && !this.activeRunController.signal.aborted) {
			this.logger.warn('Aborting previous subscription billing run before starting a new one');
			this.activeRunController.abort();
		}

		this.activeRunController = controller;
	}

	private clearActiveRunController(controller: AbortController): void {
		if (this.activeRunController === controller) {
			this.activeRunController = undefined;
		}
	}

	private async handleCandidate(candidate: BillableSubscriptionRow, runDate: Date): Promise<BillingOutcome> {
		const context: BillingAttemptContext = {
			attemptId: randomUUID(),
			attemptTime: new Date(),
			runDate,
			paymentMethodId: candidate.billing_payment_method_id,
		};

		const prepared = await this.billingPersistence.prepareAttempt(candidate, context);

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

			await this.billingPersistence.recordSuccess({
				subscription: prepared.subscription,
				context,
				payment,
			});

			return 'charged';
		} catch (error) {
			const err = error instanceof Error ? error : new Error('Unknown billing failure');
			this.logger.error(
				`Failed to charge subscription ${prepared.subscription.id} with payment method ${candidate.billing_payment_method_id}: ${err.message}`,
				err.stack,
			);

			await this.billingPersistence.recordFailure({
				subscription: prepared.subscription,
				context,
				error: err.message,
			});

			return 'failed';
		}
	}
}
