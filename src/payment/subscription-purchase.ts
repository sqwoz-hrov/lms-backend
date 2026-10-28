export interface SubscriptionDiscountInput {
	priceRubles: number;
	paidUntil: number;
	giftUntil: number;
	billingPeriodDays: number;
}

/** Keep this calculation identical to the frontend subscriptionDiscount helper. */
export function calculateSubscriptionDiscount(input: SubscriptionDiscountInput, now: number): number {
	const giftedMs = Math.max(0, input.giftUntil - now);
	// Whole paid hours keep the quote stable without valuing gifted time as paid time.
	const paidHours = Math.floor(Math.max(0, input.paidUntil - now - giftedMs) / 3_600_000);
	if (input.priceRubles <= 0 || input.billingPeriodDays <= 0) return 0;
	const credit = Math.floor((input.priceRubles * paidHours) / (input.billingPeriodDays * 24));
	return credit;
}
