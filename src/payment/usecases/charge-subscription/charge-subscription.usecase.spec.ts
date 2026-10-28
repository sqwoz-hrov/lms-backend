import { BadRequestException, ConflictException } from '@nestjs/common';
import { expect } from 'chai';
import { rejects } from 'node:assert/strict';
import * as sinon from 'sinon';
import { ChargeSubscriptionUsecase } from './charge-subscription.usecase';
import { SubscriptionRepository } from '../../../subscription/subscription.repository';
import { SubscriptionTierRepository } from '../../../subscription-tier/subscription-tier.repository';
import { UserWithSubscriptionTier } from '../../../user/user.entity';
import { YookassaClientPort } from '../../../yookassa/services/yookassa-client.interface';

const now = new Date('2026-10-01T12:00:00Z');
const day = 86400000;

describe('Charge subscription verification', () => {
	let clock: sinon.SinonFakeTimers;
	beforeEach(() => {
		clock = sinon.useFakeTimers(now);
	});
	afterEach(() => clock.restore());

	function setup(days = 15) {
		const target = { id: 'premium', tier: 'Premium', power: 2, price_rubles: 2000 };
		const user = {
			id: 'user',
			subscription_tier: { id: 'standard', tier: 'Standard', power: 1, price_rubles: 1000 },
			subscription: {
				is_gifted: false,
				current_period_end: new Date(now.getTime() + days * day),
				billing_period_days: 30,
			},
		} as UserWithSubscriptionTier;
		const charge = sinon.stub().callsFake(async params => ({
			id: 'payment',
			status: 'succeeded',
			paid: true,
			created_at: now.toISOString(),
			amount: { value: String(params.amountRubles), currency: 'RUB' },
		}));
		const fullSubscription = sinon.stub();
		const service = new ChargeSubscriptionUsecase(
			{ findActiveById: sinon.stub().resolves(target) } as unknown as SubscriptionTierRepository,
			{
				getFullSubscriptionByUser: fullSubscription,
				findPaymentMethodByUserId: sinon.stub().resolves({ payment_method_id: 'method' }),
			} as unknown as SubscriptionRepository,
			{ chargeSavedPaymentMethod: charge } as unknown as YookassaClientPort,
		);
		const execute = (expectedAmountRubles: number) =>
			service.execute({
				user,
				current_tier_id: target.id,
				expectedAmountRubles,
				idempotenceKey: 'intent',
			});
		return { user, charge, execute, fullSubscription };
	}

	it('charges the verified positive amount using normal provider idempotence', async () => {
		const { execute, charge } = setup();
		const response = await execute(1500);
		expect(response.amountRubles).to.equal(1500);
		expect(charge.firstCall.args[0]).to.include({ amountRubles: 1500, idempotenceKey: 'intent' });
		expect(charge.firstCall.args[0].metadata.purchase_mode).to.equal('upgrade_discount');
	});

	it('rejects stale amounts with 409 before charging', async () => {
		const { execute, charge } = setup();
		await rejects(execute(1501), ConflictException);
		expect(charge.called).to.equal(false);
	});

	for (const [days, expected] of [
		[60, 0],
		[90, -1000],
	]) {
		it(`rejects a verified amount of ${expected} with 400`, async () => {
			const { execute, charge } = setup(days);
			await rejects(execute(expected), BadRequestException);
			expect(charge.called).to.equal(false);
		});
	}

	it('excludes active gifted days and uses the paid tier underneath the gift', async () => {
		const { execute, charge, user, fullSubscription } = setup(25);
		user.subscription.is_gifted = true;
		user.subscription_tier = { ...user.subscription_tier, price_rubles: 10000, power: 10 };
		fullSubscription.resolves({
			currentTier: { id: 'standard', name: 'Standard', power: 1, priceRubles: 1000 },
			currentGiftTier: { until: new Date(now.getTime() + 10 * day) },
		});
		await execute(1500);
		expect(charge.firstCall.args[0].amountRubles).to.equal(1500);
	});
});
