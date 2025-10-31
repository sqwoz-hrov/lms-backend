import { registerAs } from '@nestjs/config';
import { get } from 'env-var';

export const subscriptionConfig = registerAs('subscription', () => ({
	defaultBillingPeriodDays: get('SUBSCRIPTION_DEFAULT_PERIOD_DAYS').default('30').asIntPositive(),
	defaultGracePeriodSize: get('SUBSCRIPTION_DEFAULT_GRACE_SIZE').default('3').asIntPositive(),
}));
