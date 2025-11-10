import { Subscription } from '../subscription.entity';
import { MS_IN_DAY } from '../constants';
import { getStartOfDayUtc } from './get-start-of-day-utc';

export const isDueNow = (subscription: Subscription, runDate: Date, retryWindowDays: number): boolean => {
	if (subscription.is_gifted) {
		return false;
	}

	if (!subscription.billing_period_days || subscription.billing_period_days <= 0) {
		return false;
	}

	const billingThreshold = getStartOfDayUtc(runDate);
	const retryAfter = new Date(runDate.getTime() - retryWindowDays * MS_IN_DAY);

	const periodDue = subscription.current_period_end == null || subscription.current_period_end < billingThreshold;
	const retryDue = subscription.last_billing_attempt == null || subscription.last_billing_attempt <= retryAfter;

	return periodDue && retryDue;
};
