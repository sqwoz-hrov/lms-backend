import { registerAs } from '@nestjs/config';
import { get } from 'env-var';

export const subscriptionConfig = registerAs('subscription', () => ({
	freeTierCode: get('SUBSCRIPTION_FREE_TIER_CODE').default('free').asString(),
	defaultBillingPeriodDays: get('SUBSCRIPTION_DEFAULT_PERIOD_DAYS').default('30').asIntPositive(),
	defaultGracePeriodSize: get('SUBSCRIPTION_DEFAULT_GRACE_SIZE').default('3').asIntPositive(),
}));
