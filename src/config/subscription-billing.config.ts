import { registerAs } from '@nestjs/config';
import { get } from 'env-var';

const ensureTimeFormat = (value: string): string => {
	const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
	if (!match) {
		throw new Error(`Invalid SUBSCRIPTION_BILLING_TIME value "${value}". Expected HH:mm in 24h format (e.g. "05:00").`);
	}
	return `${match[1].padStart(2, '0')}:${match[2]}`;
};

export const subscriptionBillingConfig = registerAs('subscriptionBilling', () => ({
	enabled: get('SUBSCRIPTION_BILLING_ENABLED').default('false').asBool(),
	dailyTime: ensureTimeFormat(get('SUBSCRIPTION_BILLING_TIME').default('05:00').asString()),
	batchSize: get('SUBSCRIPTION_BILLING_BATCH_SIZE').default('100').asIntPositive(),
	retryWindowDays: Math.max(0, get('SUBSCRIPTION_BILLING_RETRY_WINDOW_DAYS').default('1').asInt()),
	description: get('SUBSCRIPTION_BILLING_DESCRIPTION').default('Продление подписки').asString(),
}));
