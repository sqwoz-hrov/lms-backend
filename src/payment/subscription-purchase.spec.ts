import { expect } from 'chai';
import { calculateSubscriptionDiscount } from './subscription-purchase';

const now = Date.parse('2026-10-01T12:00:00Z');
const day = 86_400_000;
const base = {
	priceRubles: 1000,
	paidUntil: now + 15 * day,
	giftUntil: 0,
	billingPeriodDays: 30,
};
const cases = [
	{ name: 'half a paid month', input: base, discount: 500 },
	{
		name: 'excludes active gift time',
		input: { ...base, paidUntil: now + 25 * day, giftUntil: now + 10 * day },
		discount: 500,
	},
	{
		name: 'excludes fractional gift days exactly',
		input: { ...base, paidUntil: now + 15.5 * day, giftUntil: now + 0.5 * day },
		discount: 500,
	},
	{ name: 'keeps credit above target prices', input: { ...base, paidUntil: now + 90 * day }, discount: 3000 },
	{ name: 'free tier has no credit', input: { ...base, priceRubles: 0 }, discount: 0 },
	{ name: 'expired period has no credit', input: { ...base, paidUntil: now - day }, discount: 0 },
	{ name: 'gift-only time has no credit', input: { ...base, giftUntil: now + 15 * day }, discount: 0 },
	{ name: 'uses configured period length', input: { ...base, billingPeriodDays: 60 }, discount: 250 },
	{ name: 'zero billing period has no credit', input: { ...base, billingPeriodDays: 0 }, discount: 0 },
	{ name: 'ignores expired gifts', input: { ...base, giftUntil: now - day }, discount: 500 },
	{ name: 'rounds down to whole paid hours and rubles', input: { ...base, paidUntil: now + 1.01 * day }, discount: 33 },
];

describe('Subscription discount', () => {
	for (const sample of cases) {
		it(sample.name, () => expect(calculateSubscriptionDiscount(sample.input, now)).to.equal(sample.discount));
	}
	it('does not change within a paid hour', () => {
		const input = { ...base, paidUntil: now + 15 * day + 3_000_000 };
		expect(calculateSubscriptionDiscount(input, now + 2_000_000)).to.equal(calculateSubscriptionDiscount(input, now));
	});
});
