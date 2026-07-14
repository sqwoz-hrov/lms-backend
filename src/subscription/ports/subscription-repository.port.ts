import type { Subscription } from '../subscription.entity';

export type BillableSubscriptionCursor = {
	id: Subscription['id'];
	currentPeriodEnd: Subscription['current_period_end'];
};
