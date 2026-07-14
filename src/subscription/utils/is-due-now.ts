import { MS_IN_DAY } from '../constants';
import { PaidAndGiftedSubPerUserView } from '../subscription.repository';
import { getStartOfDayUtc } from './get-start-of-day-utc';

export const isDueNow = (
	subscriptionAgg: PaidAndGiftedSubPerUserView,
	runDate: Date,
	retryWindowDays: number,
): boolean => {
	const { subscription } = subscriptionAgg.currentPaidSubscription;

	if (subscriptionAgg.currentActiveGiftSubscription) {
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
