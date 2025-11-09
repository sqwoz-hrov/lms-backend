import { Inject, Injectable, Logger, OnApplicationShutdown, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { subscriptionBillingConfig } from '../../config/subscription-billing.config';
import { SubscriptionBillingService } from './subscription-billing.service';

@Injectable()
export class SubscriptionBillingScheduler implements OnModuleInit, OnModuleDestroy, OnApplicationShutdown {
	private readonly logger = new Logger(SubscriptionBillingScheduler.name);
	private timer: NodeJS.Timeout | null = null;
	private running = false;
	private activeRunController?: AbortController;

	constructor(
		private readonly billingService: SubscriptionBillingService,
		@Inject(subscriptionBillingConfig.KEY) private readonly config: ConfigType<typeof subscriptionBillingConfig>,
	) {}

	onModuleInit(): void {
		if (!this.config.enabled) {
			this.logger.debug('Subscription billing scheduler disabled');
			return;
		}

		this.scheduleNext();
	}

	onModuleDestroy(): void {
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = null;
		}

		this.abortActiveRun('module destroy');
	}

	onApplicationShutdown(signal?: string): void {
		const suffix = signal ? ` (${signal})` : '';
		this.abortActiveRun(`application shutdown${suffix}`);
	}

	private scheduleNext(reference = new Date()): void {
		if (!this.config.enabled) {
			return;
		}

		const nextRun = this.resolveNextRun(reference);
		const delay = Math.max(nextRun.getTime() - Date.now(), 0);

		if (this.timer) {
			clearTimeout(this.timer);
		}

		// eslint-disable-next-line @typescript-eslint/no-misused-promises
		this.timer = setTimeout(async () => {
			if (this.running) {
				this.logger.warn('Previous billing run still executing, skipping this tick');
				this.scheduleNext();
				return;
			}

			this.running = true;
			const controller = new AbortController();
			this.setActiveRunController(controller);

			try {
				await this.billingService.runBillingCycle({ signal: controller.signal });
			} catch (error) {
				const err = error instanceof Error ? error : new Error('Unknown scheduler error');
				this.logger.error(`Subscription billing run failed: ${err.message}`, err.stack);
			} finally {
				this.clearActiveRunController(controller);
				this.running = false;
				this.scheduleNext();
			}
		}, delay);

		this.logger.debug(`Next subscription billing run scheduled at ${nextRun.toISOString()}`);
	}

	private resolveNextRun(from: Date): Date {
		const [hours, minutes] = this.config.dailyTime.split(':').map(value => Number.parseInt(value, 10));

		const target = new Date(from);
		target.setUTCHours(hours, minutes, 0, 0);

		if (target.getTime() <= from.getTime()) {
			target.setUTCDate(target.getUTCDate() + 1);
		}

		return target;
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

	private abortActiveRun(context: string): void {
		if (this.activeRunController && !this.activeRunController.signal.aborted) {
			this.logger.warn(`Aborting subscription billing run due to ${context}`);
			this.activeRunController.abort();
		}
	}
}
