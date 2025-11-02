import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { subscriptionConfig } from '../../config/subscription.config';
import { SubscriptionTierRepository } from '../../subscription-tier/subscription-tier.repository';
import { SubscriptionManager } from './subscription.manager';

@Injectable()
export class SubscriptionManagerFactory {
	constructor(
		private readonly subscriptionTierRepository: SubscriptionTierRepository,
		@Inject(subscriptionConfig.KEY) private readonly config: ConfigType<typeof subscriptionConfig>,
	) {}

	async create(): Promise<SubscriptionManager> {
		const tiers = await this.subscriptionTierRepository.findAll();

		return new SubscriptionManager(tiers, {
			defaultBillingPeriodDays: this.config.defaultBillingPeriodDays,
			defaultGracePeriodSize: this.config.defaultGracePeriodSize,
		});
	}
}
