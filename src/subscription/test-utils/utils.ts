import { expect } from "chai";
import { Subscription } from "../subscription.entity";
import { SubscriptionTier } from "../../subscription-tier/subscription-tier.entity";

export const expectSubscriptionIsFree = (sub: Subscription, freeTier: Pick<SubscriptionTier, 'id'>, lastBillingAttempt: Date | null = null) => {
	expect(sub.current_tier_id).to.equal(freeTier.id);
	expect(sub.next_tier_id).to.equal(freeTier.id);
	expect(sub.price_on_purchase_rubles).to.equal(0);
	expect(sub.grace_period_size).to.equal(0);
	expect(sub.billing_period_days).to.equal(0);
	expect(sub.current_period_end).to.equal(null);
	expect(sub.last_billing_attempt?.getTime()).to.equal(lastBillingAttempt?.getTime());
}