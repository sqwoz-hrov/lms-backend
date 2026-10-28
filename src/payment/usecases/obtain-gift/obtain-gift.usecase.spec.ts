import { BadRequestException, ConflictException } from '@nestjs/common';
import { expect } from 'chai';
import { rejects } from 'node:assert/strict';
import * as sinon from 'sinon';
import { ObtainGiftUsecase } from './obtain-gift.usecase';
import { GiftRepository } from '../../../gift/gift.repository';
import { SubscriptionRepository } from '../../../subscription/subscription.repository';
import { SubscriptionTierRepository } from '../../../subscription-tier/subscription-tier.repository';
import { UserWithSubscriptionTier } from '../../../user/user.entity';

const now = new Date('2026-10-01T12:00:00Z');
const day = 86400000;

describe('Obtain gift eligibility', () => {
	let clock: sinon.SinonFakeTimers;
	beforeEach(() => {
		clock = sinon.useFakeTimers(now);
	});
	afterEach(() => clock.restore());

	function setup({ days = 90, allowance = 3000, giftDays = 0 } = {}) {
		const target = { id: 'premium', tier: 'Premium', power: 2, price_rubles: 1400 };
		const aggregation = {
			currentPaidSubscription: {
				currentTier: { price_rubles: 1000, power: 1 },
				subscription: {
					id: 'subscription',
					current_period_end: new Date(now.getTime() + days * day),
					billing_period_days: 30,
				},
			},
			currentActiveGiftSubscription: giftDays
				? { gift: { until: new Date(now.getTime() + giftDays * day) }, currentTier: { giftedTierPower: 3 } }
				: undefined,
		};
		const previous = sinon.stub().resolves(undefined);
		const query = {
			select: sinon.stub().returnsThis(),
			where: sinon.stub().returnsThis(),
			limit: sinon.stub().returnsThis(),
			executeTakeFirst: previous,
		};
		const trx = { selectFrom: sinon.stub().returns(query) };
		const create = sinon.stub().resolves({ id: 'gift', duration_days: 30 });
		const getAllowance = sinon.stub().resolves(allowance);
		const subscriptionRepository = {
			transaction: (handler: (transaction: typeof trx) => Promise<unknown>) => handler(trx),
			lockSubscriptionByUserId: sinon.stub().resolves(aggregation),
			getSelfGiftAllowance: getAllowance,
			insertPaymentEvent: sinon.stub().resolves(),
		};
		const usecase = new ObtainGiftUsecase(
			subscriptionRepository as unknown as SubscriptionRepository,
			{ findActiveById: sinon.stub().resolves(target) } as unknown as SubscriptionTierRepository,
			{ create } as unknown as GiftRepository,
		);
		const execute = () =>
			usecase.execute({
				user: { id: 'user' } as UserWithSubscriptionTier,
				current_tier_id: target.id,
				idempotenceKey: 'intent',
			});
		return { execute, create, getAllowance, aggregation, previous, target, trx };
	}

	it('creates an inactive self-gift when both discount and actual spending cover its price', async () => {
		const { execute, create, getAllowance, trx } = setup({ allowance: 1400 });
		expect(await execute()).to.deep.equal({ giftId: 'gift', durationDays: 30 });
		expect(create.firstCall.args).to.deep.equal([
			{
				gifted_to: 'user',
				gifted_by: 'user',
				tier_id: 'premium',
				duration_days: 30,
				activated_at: null,
			},
			trx,
		]);
		expect(getAllowance.firstCall.args).to.deep.equal(['user', trx]);
	});

	it('rejects a sufficient discount when successful spending minus self-gifts is insufficient', async () => {
		const { execute, create } = setup({ allowance: 1399 });
		await rejects(execute(), ConflictException);
		expect(create.called).to.equal(false);
	});

	it('rejects an insufficient discount even when the spending allowance is large', async () => {
		const { execute, create } = setup({ days: 15, allowance: 100000 });
		await rejects(execute(), ConflictException);
		expect(create.called).to.equal(false);
	});

	it('allows equality between discount and tier cost', async () => {
		const { execute } = setup({ days: 42, allowance: 1400 });
		expect((await execute()).giftId).to.equal('gift');
	});

	it('excludes gifted time and does not alter an active gift or paid expiry', async () => {
		const { execute, aggregation } = setup({ days: 75, giftDays: 30, allowance: 1400 });
		const before = structuredClone(aggregation);
		expect((await execute()).giftId).to.equal('gift');
		expect(aggregation).to.deep.equal(before);
	});

	it('rejects gifted-only eligibility even with enough past spending', async () => {
		const { execute, create } = setup({ days: 60, giftDays: 30 });
		await rejects(execute(), ConflictException);
		expect(create.called).to.equal(false);
	});

	it('replays an existing claim even after the allowance has been spent', async () => {
		const { execute, previous, create, getAllowance } = setup({ allowance: 0 });
		previous.resolves({ event: { tierId: 'premium', giftId: 'existing', durationDays: 30 } });
		expect(await execute()).to.deep.equal({ giftId: 'existing', durationDays: 30 });
		expect(create.called).to.equal(false);
		expect(getAllowance.called).to.equal(false);
	});

	it('rejects a gift below the paid tier', async () => {
		const { execute, target, create } = setup();
		target.power = 0;
		await rejects(execute(), BadRequestException);
		expect(create.called).to.equal(false);
	});
});
