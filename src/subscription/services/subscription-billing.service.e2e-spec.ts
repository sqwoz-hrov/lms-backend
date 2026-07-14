import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { expect } from 'chai';
import { Kysely, sql } from 'kysely';
import { createTestSubscriber, createTestSubscriptionTier } from '../../../test/fixtures/user.fixture';
import { ISharedContext } from '../../../test/setup/test.app-setup';
import {
	ChargeSavedPaymentParams,
	YookassaClientPort,
	YookassaPaymentResponse,
} from '../../yookassa/services/yookassa-client.interface';
import { jwtConfig, subscriptionBillingConfig } from '../../config';
import { DatabaseProvider } from '../../infra/db/db.provider';
import { GiftAggregation } from '../../gift/gift.entity';
import { GiftTestRepository } from '../../gift/test-utils/test.repo';
import { UsersTestRepository } from '../../user/test-utils/test.repo';
import { BillingEventType } from '../constants';
import { SubscriptionRepository } from '../subscription.repository';
import { SubscriptionTestRepository } from '../test-utils/test.repo';
import { SubscriptionStateService } from '../domain/subscription.state';
import { SubscriptionService } from './subscription.service';
import { SubscriptionBillingService } from './subscription-billing.service';
import { UserRepository } from '../../user/user.repository';
import { YookassaPaymentSucceededWebhook, YookassaWebhookPayload } from '../types/yookassa-webhook';
import { SubscriptionTestSdk } from '../test-utils/test.sdk';
import { TestHttpClient } from '../../../test/test.http-client';

const baseConfig = {
	enabled: true,
	dailyTime: '05:00',
	batchSize: 50,
	retryWindowDays: 1,
	description: 'Продление подписки',
};

describe('SubscriptionBillingService integration', () => {
	let app: INestApplication;
	let db: Kysely<GiftAggregation>;
	let usersTestRepo: UsersTestRepository;
	let subscriptionTestRepo: SubscriptionTestRepository;
	let giftRepo: GiftTestRepository;
	let subscriptionRepository: SubscriptionRepository;
	let subscriptionStateService: SubscriptionStateService;
	let usersRepo: UserRepository;
	let subscriptionSdk: SubscriptionTestSdk;

	before(function (this: ISharedContext) {
		app = this.app;
		const dbProvider = app.get(DatabaseProvider);
		db = dbProvider.getDatabase<GiftAggregation>();
		usersTestRepo = new UsersTestRepository(dbProvider);
		subscriptionTestRepo = new SubscriptionTestRepository(dbProvider);
		giftRepo = new GiftTestRepository(dbProvider);
		subscriptionRepository = new SubscriptionRepository(dbProvider);
		subscriptionStateService = app.get(SubscriptionStateService);
		usersRepo = app.get(UserRepository);

		subscriptionSdk = new SubscriptionTestSdk(
			new TestHttpClient(
				{
					port: 3000,
					host: 'http://127.0.0.1',
				},
				app.get<ConfigType<typeof jwtConfig>>(jwtConfig.KEY),
			),
		);
	});

	afterEach(async () => {
		await giftRepo.clearAll();
		await subscriptionTestRepo.clearAll();
		await usersTestRepo.clearAll();
	});

	const sendWebhook = async (payload: YookassaWebhookPayload) => {
		const response = await subscriptionSdk.sendYookassaWebhook({
			params: payload,
			userMeta: { isAuth: false },
		});
		expect(response.status).to.equal(HttpStatus.OK);
	};

	const createService = (
		params: { yookassa?: YookassaClientPort; config?: Partial<ConfigType<typeof subscriptionBillingConfig>> } = {},
	) =>
		new SubscriptionBillingService(
			subscriptionRepository,
			params.yookassa ?? new RecordingYookassaClient(),
			{ ...baseConfig, ...(params.config ?? {}) },
			new SubscriptionService(subscriptionRepository, subscriptionStateService),
		);

	const seedDueSubscriber = async (params: {
		userKey: string;
		currentTierPower?: number;
		nextTierPower?: number;
		currentPriceRubles?: number;
		nextPriceRubles?: number;
		currentPeriodEnd?: Date | null;
		lastBillingAttempt?: Date | null;
		paymentMethodId?: string | null;
	}) => {
		const freeTier = await createTestSubscriptionTier(usersTestRepo, {
			tier: `free-${params.userKey}`,
			power: 0,
			price_rubles: 0,
		});
		const currentTier = await createTestSubscriptionTier(usersTestRepo, {
			tier: `current-${params.userKey}`,
			power: params.currentTierPower ?? 1,
			price_rubles: params.currentPriceRubles ?? 1000,
		});
		const nextTier =
			params.nextTierPower === undefined || params.nextTierPower === currentTier.power
				? currentTier
				: await createTestSubscriptionTier(usersTestRepo, {
						tier: `next-${params.userKey}`,
						power: params.nextTierPower,
						price_rubles: params.nextPriceRubles ?? 2000,
					});

		const subscriber = await createTestSubscriber(usersTestRepo, {
			current_tier_id: currentTier.id,
			active_until: params.currentPeriodEnd ?? new Date('2024-01-01T00:00:00.000Z'),
		});

		const newSubscription = await usersTestRepo.connection
			.updateTable('subscription')
			.set({
				next_tier_id: nextTier.id,
				price_on_purchase_rubles: params.currentPriceRubles ?? currentTier.price_rubles,
				current_period_end: params.currentPeriodEnd ?? new Date('2024-01-01T00:00:00.000Z'),
				last_billing_attempt: params.lastBillingAttempt ?? null,
				updated_at: new Date(),
			})
			.where('id', '=', subscriber.subscription.id)
			.returningAll()
			.executeTakeFirstOrThrow();

		if (params.paymentMethodId !== null) {
			await subscriptionTestRepo.addActivePaymentMethod({
				userId: subscriber.id,
				paymentMethodId: params.paymentMethodId ?? `pm-${params.userKey}`,
			});
		}

		return {
			subscriber: {
				...subscriber,
				subscription: { ...newSubscription },
			},
			currentTier,
			nextTier,
			freeTier,
		};
	};

	const findEvents = async () => await subscriptionTestRepo.findPaymentEvents();

	it('skips execution when billing disabled', async () => {
		await seedDueSubscriber({ userKey: 'disabled' });
		const yookassa = new RecordingYookassaClient();
		const service = createService({ yookassa, config: { enabled: false } });

		const summary = await service.runBillingCycle({ now: new Date('2024-02-01T00:00:00.000Z') });

		expect(summary).to.deep.equal({ processed: 0, charged: 0, skipped: 0, failed: 0, downgradedToFreeTier: 0 });
		expect(yookassa.calls).to.have.length(0);
	});

	// TODO: we used to do this with missing subscription on a 'subscriber' roled-user
	it('skips billing when persistence cannot load the subscription', async () => {
		await seedDueSubscriber({ userKey: 'missing' });
		const originalLock = subscriptionRepository.lockSubscriptionByUserId.bind(subscriptionRepository);
		subscriptionRepository.lockSubscriptionByUserId = async () => undefined;

		try {
			const summary = await createService().runBillingCycle({ now: new Date('2024-02-01T00:00:00.000Z') });

			expect(summary).to.deep.equal({ processed: 1, charged: 0, skipped: 1, failed: 0, downgradedToFreeTier: 0 });
			expect(await findEvents()).to.have.length(0);
		} finally {
			subscriptionRepository.lockSubscriptionByUserId = originalLock;
		}
	});

	it('skips billing when subscription is not due yet', async () => {
		await seedDueSubscriber({
			userKey: 'not-due',
			currentPeriodEnd: new Date('2024-05-15T00:00:00.000Z'),
		});

		const summary = await createService().runBillingCycle({ now: new Date('2024-05-10T06:00:00.000Z') });

		expect(summary).to.deep.equal({ processed: 0, charged: 0, skipped: 0, failed: 0, downgradedToFreeTier: 0 });
		expect(await findEvents()).to.have.length(0);
	});

	it('charges due subscriptions and records charge attempt success. current_tier_id in the meta is the next_tier_id from current subscription', async () => {
		const { subscriber, nextTier, currentTier } = await seedDueSubscriber({
			userKey: 'success',
			currentTierPower: 1,
			nextTierPower: 2,
			nextPriceRubles: 2000,
		});
		const yookassa = new RecordingYookassaClient({ nextPayment: createPaymentResponse({ id: 'payment-1' }) });

		expect(subscriber.subscription_tier.id).to.equal(currentTier.id);
		expect(subscriber.subscription_tier.id).to.not.equal(nextTier.id);

		const summary = await createService({ yookassa }).runBillingCycle({ now: new Date('2024-02-01T00:00:00.000Z') });

		expect(summary).to.deep.equal({ processed: 1, charged: 1, skipped: 0, failed: 0, downgradedToFreeTier: 0 });
		expect(yookassa.calls).to.have.length(1);
		expect(yookassa.calls[0].metadata.user_id).to.equal(subscriber.id);
		expect(yookassa.calls[0].metadata.current_tier_id).to.equal(nextTier.id);

		const events = await findEvents();
		expect(events.map(event => (event.event as { type?: string }).type)).to.have.members([
			BillingEventType.ATTEMPT_PREPARED,
			BillingEventType.CHARGE_REQUESTED,
		]);
	});

	it('processes all due subscriptions even when total exceeds batch size', async () => {
		const yookassa = new RecordingYookassaClient();
		for (let i = 0; i < 5; i += 1) {
			await seedDueSubscriber({
				userKey: `batch-${i}`,
				paymentMethodId: `pm-batch-${i}`,
				currentPeriodEnd: new Date('2024-01-01T00:00:00.000Z'),
			});
		}

		const summary = await createService({ yookassa, config: { batchSize: 2 } }).runBillingCycle({
			now: new Date('2024-02-01T00:00:00.000Z'),
		});

		expect(summary).to.deep.equal({ processed: 5, charged: 5, skipped: 0, failed: 0, downgradedToFreeTier: 0 });
		expect(yookassa.calls).to.have.length(5);
	});

	it('does not charge the same subscription twice when queue mutates mid-run', async () => {
		let inserted = false;
		const yookassa = new RecordingYookassaClient({
			onCharge: async params => {
				if (inserted) return;
				inserted = true;
				await usersTestRepo.connection
					.updateTable('subscription')
					.set({ current_period_end: new Date('2024-01-05T00:00:00.000Z'), updated_at: new Date() })
					.where('user_id', '=', params.metadata.user_id)
					.execute();
				await seedDueSubscriber({
					userKey: 'mutated-new',
					paymentMethodId: 'pm-mutated-new',
					currentPeriodEnd: new Date('2024-01-01T00:00:00.000Z'),
				});
			},
		});

		await seedDueSubscriber({
			userKey: 'mutated-original',
			paymentMethodId: 'pm-mutated-original',
			currentPeriodEnd: new Date('2024-01-01T00:00:00.000Z'),
		});
		await seedDueSubscriber({
			userKey: 'mutated-second',
			paymentMethodId: 'pm-mutated-second',
			currentPeriodEnd: new Date('2024-01-01T00:00:00.000Z'),
		});

		const summary = await createService({ yookassa, config: { batchSize: 1 } }).runBillingCycle({
			now: new Date('2024-02-01T00:00:00.000Z'),
		});

		expect(summary).to.deep.equal({ processed: 3, charged: 3, skipped: 0, failed: 0, downgradedToFreeTier: 0 });
		expect(new Set(yookassa.calls.map(call => call.metadata.user_id)).size).to.equal(3);
	});

	it('stops processing when application shutdown interrupts a billing run', async () => {
		for (let i = 0; i < 3; i += 1) {
			await seedDueSubscriber({
				userKey: `abort-${i}`,
				paymentMethodId: `pm-abort-${i}`,
				currentPeriodEnd: new Date('2024-01-01T00:00:00.000Z'),
			});
		}

		const yookassa = new DelayedYookassaClient(25);
		const abortController = new AbortController();
		const service = createService({ yookassa });

		const runPromise = service.runBillingCycle({
			now: new Date('2024-02-01T00:00:00.000Z'),
			signal: abortController.signal,
		});
		await wait(5);
		abortController.abort();

		const summary = await runPromise;

		expect(summary).to.deep.equal({ processed: 1, charged: 1, skipped: 0, failed: 0, downgradedToFreeTier: 0 });
		expect(yookassa.calls).to.have.length(1);

		const newYookassaClient = new RecordingYookassaClient();
		const newService = createService({ yookassa: newYookassaClient });
		const newAbortController = new AbortController();
		const secondRunSummary = await newService.runBillingCycle({
			now: new Date('2024-02-01T00:00:00.000Z'),
			signal: newAbortController.signal,
		});

		expect(secondRunSummary).to.deep.equal({
			processed: 2,
			charged: 2,
			skipped: 0,
			failed: 0,
			downgradedToFreeTier: 0,
		});
		expect(newYookassaClient.calls).to.have.length(2);
	});

	it("skips billing on a user when he's on active gift until the gift expires", async () => {
		const { subscriber, nextTier } = await seedDueSubscriber({
			userKey: 'active-gift',
			currentTierPower: 2,
			nextTierPower: 2,
			currentPeriodEnd: new Date('2024-01-01T00:00:00.000Z'),
		});

		const giftedTier = await createTestSubscriptionTier(usersTestRepo, {
			power: 2,
		});

		await giftRepo.insertGift({
			gifted_by: subscriber.id,
			gifted_to: subscriber.id,
			tier_id: giftedTier.id,
			duration_days: 10,
			activated_at: new Date(),
		});

		const userWithSub = await usersRepo.findByIdWithSubscriptionTier(subscriber.id);
		expect(userWithSub?.subscription?.is_gifted).to.be.true;
		expect(userWithSub?.subscription?.current_tier_id).to.equal(giftedTier.id);
		expect(userWithSub?.subscription?.next_tier_id).to.equal(nextTier.id);

		const yookassa = new RecordingYookassaClient();
		const summary = await createService({ yookassa }).runBillingCycle({ now: new Date('2024-02-01T00:00:00.000Z') });

		expect(summary).to.deep.equal({ processed: 1, charged: 0, skipped: 1, failed: 0, downgradedToFreeTier: 0 });
		expect(yookassa.calls).to.have.length(0);

		const userWithSubAfter = await usersRepo.findByIdWithSubscriptionTier(subscriber.id);
		expect(userWithSubAfter?.subscription?.is_gifted).to.be.true;
		expect(userWithSubAfter?.subscription?.current_tier_id).to.equal(giftedTier.id);
		expect(userWithSubAfter?.subscription?.next_tier_id).to.equal(nextTier.id);
	});

	it("doesn't charge a user who has next_tier_id pointing to a free tier yet his current_tier_id is a paid tier. This user gets downgraded to free tier", async () => {
		const freeTier = await createTestSubscriptionTier(usersTestRepo, { tier: 'free-next', power: 0, price_rubles: 0 });
		const paidTier = await createTestSubscriptionTier(usersTestRepo, {
			tier: 'paid-next-free',
			power: 2,
			price_rubles: 2000,
		});
		const subscriber = await createTestSubscriber(usersTestRepo, {
			current_tier_id: paidTier.id,
			active_until: new Date('2024-01-01T00:00:00.000Z'),
		});
		await usersTestRepo.connection
			.updateTable('subscription')
			.set({ next_tier_id: freeTier.id, updated_at: new Date() })
			.where('id', '=', subscriber.subscription.id)
			.execute();
		await subscriptionTestRepo.addActivePaymentMethod({ userId: subscriber.id, paymentMethodId: 'pm-next-free' });

		const yookassa = new RecordingYookassaClient();

		const userWithSubBeforeBilling = await usersRepo.findByIdWithSubscriptionTier(subscriber.id);
		expect(userWithSubBeforeBilling?.subscription?.current_tier_id).to.equal(paidTier.id);
		expect(userWithSubBeforeBilling?.subscription?.next_tier_id).to.equal(freeTier.id);

		const summary = await createService({ yookassa }).runBillingCycle({ now: new Date('2024-02-01T00:00:00.000Z') });

		expect(summary).to.deep.equal({ processed: 1, charged: 0, skipped: 0, failed: 0, downgradedToFreeTier: 1 });
		expect(yookassa.calls).to.have.length(0);

		const subAfterBilling = await subscriptionTestRepo.findById(subscriber.subscription.id);
		expect(subAfterBilling?.current_tier_id).to.equal(freeTier.id);
		expect(subAfterBilling?.next_tier_id).to.equal(freeTier.id);
		expect(subAfterBilling?.billing_period_days).to.equal(0);

		const userWithSubAfter = await usersRepo.findByIdWithSubscriptionTier(subscriber.id);
		expect(userWithSubAfter?.subscription?.is_gifted).to.be.false;
		expect(userWithSubAfter?.subscription?.current_tier_id).to.equal(freeTier.id);
		expect(userWithSubAfter?.subscription?.next_tier_id).to.equal(freeTier.id);
	});

	it("doesn't charge on a user if there's no payment method, user gets downgraded to free tier if he's due to pay but no payment method", async () => {
		const { subscriber, currentTier, nextTier, freeTier } = await seedDueSubscriber({
			userKey: 'no-payment-method',
			currentPriceRubles: 3000,
			currentTierPower: 5,
			nextPriceRubles: 4000,
			nextTierPower: 6,
			paymentMethodId: null,
		});

		const yookassa = new RecordingYookassaClient();

		expect(subscriber?.subscription?.current_tier_id).to.equal(currentTier.id);
		expect(subscriber?.subscription?.next_tier_id).to.equal(nextTier.id);

		const summary = await createService({ yookassa }).runBillingCycle({ now: new Date('2024-02-01T00:00:00.000Z') });

		expect(summary).to.deep.equal({ processed: 1, charged: 0, skipped: 0, failed: 0, downgradedToFreeTier: 1 });
		expect(yookassa.calls).to.have.length(0);
		const sub = await subscriptionTestRepo.findById(subscriber.subscription.id);
		expect(sub?.current_tier_id).to.equal(freeTier.id);
		expect(sub?.next_tier_id).to.equal(freeTier.id);

		const userWithSubAfter = await usersRepo.findByIdWithSubscriptionTier(subscriber.id);
		expect(userWithSubAfter?.subscription?.is_gifted).to.be.false;
		expect(userWithSubAfter?.subscription?.current_tier_id).to.equal(freeTier.id);
		expect(userWithSubAfter?.subscription?.next_tier_id).to.equal(freeTier.id);
	});

	it('charge is being made for the next_tier_id tier, not the current_tier_id', async () => {
		const { currentTier, nextTier } = await seedDueSubscriber({
			userKey: 'next-tier-charge',
			currentTierPower: 1,
			nextTierPower: 3,
			currentPriceRubles: 1000,
			nextPriceRubles: 3000,
		});

		const yookassa = new RecordingYookassaClient();
		const summary = await createService({ yookassa }).runBillingCycle({ now: new Date('2024-02-01T00:00:00.000Z') });

		expect(summary).to.deep.equal({ processed: 1, charged: 1, skipped: 0, failed: 0, downgradedToFreeTier: 0 });
		expect(yookassa.calls[0].metadata.current_tier_id).to.equal(nextTier.id);
		expect(yookassa.calls[0].metadata.current_tier_id).to.not.equal(currentTier.id);
		expect(yookassa.calls[0].amountRubles).to.equal(nextTier.price_rubles);
	});

	it('first cycle skips paid subscribers who have been on active gift sub but when the gift expires before second cycle run they will be charged', async () => {
		const { subscriber, currentTier, nextTier } = await seedDueSubscriber({
			userKey: 'gift-expiry',
			currentTierPower: 2,
			nextTierPower: 1,
			nextPriceRubles: 1000,
			currentPriceRubles: 2000,
		});
		const gift = await giftRepo.insertGift({
			gifted_by: subscriber.id,
			gifted_to: subscriber.id,
			tier_id: currentTier.id,
			duration_days: 2,
			activated_at: new Date(),
		});

		const userWithSub = await usersRepo.findByIdWithSubscriptionTier(subscriber.id);
		expect(userWithSub?.subscription?.is_gifted).to.be.true;
		expect(userWithSub?.subscription?.current_tier_id).to.equal(currentTier.id);
		expect(userWithSub?.subscription?.price_on_purchase_rubles).to.equal(currentTier.price_rubles);
		expect(userWithSub?.subscription?.next_tier_id).to.equal(nextTier.id);

		const yookassa = new RecordingYookassaClient();
		const firstSummary = await createService({ yookassa }).runBillingCycle({
			now: new Date('2024-02-01T00:00:00.000Z'),
		});
		expect(firstSummary.skipped).to.equal(1);
		expect(yookassa.calls).to.have.length(0);

		const userWithSubAfterFirst = await usersRepo.findByIdWithSubscriptionTier(subscriber.id);
		expect(userWithSubAfterFirst?.subscription?.is_gifted).to.be.true;
		expect(userWithSubAfterFirst?.subscription?.current_tier_id).to.equal(currentTier.id);
		expect(userWithSubAfterFirst?.subscription?.next_tier_id).to.equal(nextTier.id);

		await db
			.updateTable('gift')
			.set({ activated_at: sql`activated_at - interval '3 days'` })
			.where('id', '=', gift.id)
			.execute();

		const secondSummary = await createService({ yookassa }).runBillingCycle({
			now: new Date('2024-02-03T00:00:00.000Z'),
		});
		expect(secondSummary.charged).to.equal(1);
		expect(yookassa.calls).to.have.length(1);

		// simulate sdk call
		const occurredAt = new Date('2024-02-03T00:00:10.000Z');

		if (yookassa.responses[0].paid !== true) {
			throw new Error('expected payment success on fake');
		}

		const payload: YookassaPaymentSucceededWebhook = {
			event: 'payment.succeeded',
			object: {
				id: yookassa.responses[0].id,
				status: 'succeeded',
				paid: yookassa.responses[0].paid,
				amount: {
					value: yookassa.responses[0].amount.value,
					currency: yookassa.responses[0].amount.currency as unknown as 'RUB',
				},
				metadata: {
					...yookassa.calls[0].metadata,
				},
				created_at: occurredAt.toISOString(),
				payment_method: {
					id: yookassa.calls[0].paymentMethodId,
					type: 'bank_card',
					saved: true,
					card: { last4: '4242' },
				},
			},
		};

		// response from sdk
		await sendWebhook(payload);

		const userWithSubAfterSecond = await usersRepo.findByIdWithSubscriptionTier(subscriber.id);
		expect(userWithSubAfterSecond?.subscription?.is_gifted).to.be.false;
		expect(userWithSubAfterSecond?.subscription?.current_tier_id).to.equal(nextTier.id);
		expect(userWithSubAfterSecond?.subscription?.next_tier_id).to.equal(nextTier.id);
		// we probably don't update the thing here, we just charge for the next tier
		// should make sure to update in webhook processing
		expect(userWithSubAfterSecond?.subscription?.price_on_purchase_rubles).to.equal(nextTier.price_rubles);
	});

	// TODO: alert on broken subs
	// "broken" subs that are not on free tier but have this data are just left out
	it('treats broken sub records as not due', async () => {
		const { subscriber, currentTier, nextTier } = await seedDueSubscriber({
			userKey: 'gift-expiry',
			currentTierPower: 2,
			nextTierPower: 1,
			paymentMethodId: `pm-case-gift-expiry`,
		});

		await usersTestRepo.connection
			.updateTable('subscription')
			.set({
				current_period_end: null,
				last_billing_attempt: null,
				billing_period_days: 0,
				updated_at: new Date(),
			})
			.where('id', '=', subscriber?.subscription?.id)
			.executeTakeFirst();

		const userWithSub = await usersRepo.findByIdWithSubscriptionTier(subscriber.id);
		expect(userWithSub?.subscription?.is_gifted).to.be.false;
		expect(userWithSub?.subscription?.current_tier_id).to.equal(currentTier.id);
		expect(userWithSub?.subscription?.next_tier_id).to.equal(nextTier.id);

		const yookassa = new RecordingYookassaClient();
		const summary = await createService({ yookassa }).runBillingCycle({ now: new Date('2024-02-01T00:00:00.000Z') });

		//charge if he has payment method attached
		expect(summary).to.deep.equal({ processed: 0, charged: 0, skipped: 0, failed: 0, downgradedToFreeTier: 0 });

		// expect everything is still the same
		const userWithSubAfterPayment = await usersRepo.findByIdWithSubscriptionTier(subscriber.id);
		expect(userWithSubAfterPayment?.subscription?.is_gifted).to.be.false;
		expect(userWithSubAfterPayment?.subscription?.current_tier_id).to.equal(currentTier.id);
		expect(userWithSubAfterPayment?.subscription?.next_tier_id).to.equal(nextTier.id);

		expect(userWithSubAfterPayment?.subscription?.current_period_end?.toUTCString()).to.equal(
			userWithSub?.subscription?.current_period_end?.toUTCString(),
		);
		expect(userWithSubAfterPayment?.subscription?.current_period_end?.toUTCString()).to.be.undefined;
		expect(userWithSubAfterPayment?.subscription?.billing_period_days).to.equal(0);

		// TODO: use sinon please, this is dumb asf
		// last billing attempt around ~now
		expect(userWithSubAfterPayment?.subscription?.last_billing_attempt?.getTime()).to.be.undefined;
	});

	// The following cases were skipped since we rely on webhooks to determine next state of the sub in billing
	// and 4xx/5xx means we've screwed up somewhere and it's an alert
	// add case when charge call fails as payment method is invalid in the provider and subscriber outside grace period
	// add case when charge call fails as payment method is invalid in the provider and subscriber inside grace period
});

class RecordingYookassaClient implements YookassaClientPort {
	public readonly calls: ChargeSavedPaymentParams[] = [];
	public readonly responses: YookassaPaymentResponse[] = [];
	private readonly nextPayment: YookassaPaymentResponse;
	private readonly onCharge?: (params: ChargeSavedPaymentParams) => void | Promise<void>;

	constructor(params?: {
		nextPayment?: YookassaPaymentResponse;
		onCharge?: (params: ChargeSavedPaymentParams) => void | Promise<void>;
	}) {
		this.nextPayment = params?.nextPayment ?? createPaymentResponse();
		this.onCharge = params?.onCharge;
	}

	async chargeSavedPaymentMethod(params: ChargeSavedPaymentParams): Promise<YookassaPaymentResponse> {
		this.calls.push(params);
		if (this.onCharge) {
			await this.onCharge(params);
		}
		const resp = {
			...this.nextPayment,
			metadata: params.metadata,
			amount: { value: params.amountRubles.toFixed(2), currency: 'RUB' },
		};
		this.responses.push(resp);

		return resp;
	}
}

class DelayedYookassaClient extends RecordingYookassaClient {
	private readonly delayMs: number;

	constructor(delayMs: number) {
		super();
		this.delayMs = delayMs;
	}

	async chargeSavedPaymentMethod(params: ChargeSavedPaymentParams): Promise<YookassaPaymentResponse> {
		await wait(this.delayMs);
		return super.chargeSavedPaymentMethod(params);
	}
}

const createPaymentResponse = (overrides: Partial<YookassaPaymentResponse> = {}): YookassaPaymentResponse => ({
	id: overrides.id ?? 'payment-default',
	status: overrides.status ?? 'succeeded',
	paid: overrides.paid ?? true,
	amount: overrides.amount ?? { value: '0.00', currency: 'RUB' },
	confirmation:
		overrides.confirmation ??
		({
			type: 'redirect',
			confirmation_url: 'https://example.test',
		} as const),
	metadata: overrides.metadata ?? {},
	created_at: overrides.created_at ?? new Date().toISOString(),
});

const wait = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));
