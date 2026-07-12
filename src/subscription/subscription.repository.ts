import { Inject, Injectable } from '@nestjs/common';
import { Kysely, NotNull, Transaction, sql } from 'kysely';
import { DatabaseProvider } from '../infra/db/db.provider';
import { UserAggregation } from '../user/user.entity';
import type { BillableSubscriptionCursor } from './ports/subscription-repository.port';
import { NewSubscription, Subscription, SubscriptionAggregation, SubscriptionUpdate } from './subscription.entity';
import { getStartOfDayUtc } from './utils/get-start-of-day-utc';
import { MS_IN_DAY } from './constants';
import {
	PaymentEventTable,
	PaymentMethod,
	NewPaymentEvent,
	NewPaymentMethod,
	PaymentMethodStatus,
} from '../payment/payment.entity';
import { SubscriptionTier } from '../subscription-tier/subscription-tier.entity';
import { UserSubscriptionTransaction } from '../user/user.repository';

export type SubscriptionDatabase = SubscriptionAggregation &
	UserAggregation & {
		payment_event: PaymentEventTable;
	};

export type SubscriptionTransaction = Transaction<SubscriptionDatabase>;

type SubscriptionQueryExecutor = Kysely<SubscriptionDatabase> | SubscriptionTransaction;

type FindBillableSubscriptionsParams = {
	runDate: Date;
	retryWindowDays: number;
	limit: number;
	cursor?: BillableSubscriptionCursor;
	trx?: SubscriptionTransaction;
};

type FindDowngradeCandidateSubscriptionsParams = FindBillableSubscriptionsParams;

export type BillableSubscriptionRow = Subscription & {
	billing_payment_method_id: PaymentMethod['payment_method_id'];
};

export type DowngradeCandidateSubscriptionRow = Subscription & {
	billingPaymentMethodId: PaymentMethod['payment_method_id'] | null;
	nextTierIsFree: boolean;
};

type FullSubscriptionTier = {
	id: SubscriptionTier['id'];
	name: SubscriptionTier['tier'];
	permissions: SubscriptionTier['permissions'];
};

export type SubscriptionTierWithoutPrivateFields = Omit<SubscriptionTier, 'is_archived' | 'markdown_description_id'>;

export type FullSubscription = {
	currentGiftTier: (FullSubscriptionTier & { until: Date }) | null;
	currentTier: FullSubscriptionTier & { until: Subscription['current_period_end'] };
	nextTier: FullSubscriptionTier;
	nextPayment: {
		amount: SubscriptionTier['price_rubles'];
		date: Subscription['current_period_end'];
	};
};

export type PaidAndGiftedSubPerUserView = {
	currentPaidSubscription: {
		subscription: Subscription;
		currentTier: SubscriptionTierWithoutPrivateFields;
		nextTier: SubscriptionTierWithoutPrivateFields;
	};
	currentActiveGiftSubscription:
		| {
				gift: {
					giftId: string;
					giftedDaysLeft: number;
				};
				currentTier: {
					giftedTierId: string;
					giftedTierPower: number;
				};
		  }
		| undefined;
};

@Injectable()
export class SubscriptionRepository {
	private readonly db: Kysely<SubscriptionDatabase>;

	constructor(@Inject(DatabaseProvider) dbProvider: DatabaseProvider) {
		this.db = dbProvider.getDatabase<SubscriptionDatabase>();
	}

	async transaction<T>(handler: (trx: SubscriptionTransaction) => Promise<T>): Promise<T> {
		return await this.db.transaction().execute(handler);
	}

	private getExecutor(trx?: SubscriptionTransaction): SubscriptionQueryExecutor {
		return trx ?? this.db;
	}

	async getFreeTier(trx?: SubscriptionTransaction): Promise<SubscriptionTier> {
		return await this.getExecutor(trx)
			.selectFrom('subscription_tier')
			.selectAll()
			.where('power', '=', 0)
			.orderBy('id', 'desc')
			.limit(1)
			.executeTakeFirstOrThrow();
	}

	async getTierById(id: SubscriptionTier['id'], trx?: SubscriptionTransaction): Promise<SubscriptionTier> {
		return await this.getExecutor(trx)
			.selectFrom('subscription_tier')
			.selectAll()
			.where('id', '=', id)
			.orderBy('id', 'desc')
			.limit(1)
			.executeTakeFirstOrThrow();
	}

	async create(data: NewSubscription, trx: UserSubscriptionTransaction): Promise<Subscription> {
		return await trx
			.insertInto('subscription')
			.values({
				...data,
				updated_at: sql`now()`,
			})
			.returningAll()
			.executeTakeFirstOrThrow();
	}

	async update(
		id: Subscription['id'],
		data: SubscriptionUpdate,
		trx?: SubscriptionTransaction,
	): Promise<Subscription | undefined> {
		const executor = this.getExecutor(trx);
		const result = await executor
			.updateTable('subscription')
			.set({
				...data,
				updated_at: sql`now()`,
			})
			.where('id', '=', id)
			.returningAll()
			.executeTakeFirst();

		return result ?? undefined;
	}

	async updateBatch(ids: Subscription['id'][], data: SubscriptionUpdate, trx?: SubscriptionTransaction) {
		const executor = this.getExecutor(trx);

		const res = await executor
			.updateTable('subscription')
			.set({
				...data,
				updated_at: sql`now()`,
			})
			.where('id', 'in', ids)
			.execute();

		return {
			updated: res?.at(0)?.numUpdatedRows.toString() ?? '0',
		};
	}

	async deleteById(id: Subscription['id'], trx?: SubscriptionTransaction): Promise<void> {
		const executor = this.getExecutor(trx);
		await executor.deleteFrom('subscription').where('id', '=', id).execute();
	}

	async findById(id: Subscription['id'], trx?: SubscriptionTransaction): Promise<Subscription | undefined> {
		const executor = this.getExecutor(trx);
		return await executor.selectFrom('subscription').selectAll().where('id', '=', id).limit(1).executeTakeFirst();
	}

	async findByUserIdWithTiers(
		userId: Subscription['user_id'],
		trx?: SubscriptionTransaction,
	): Promise<
		| {
				subscription: Subscription;
				currentTier: { power: number; price: number };
				nextTier: { power: number; price: number };
		  }
		| undefined
	> {
		const executor = this.getExecutor(trx);

		const res = await executor
			.selectFrom('subscription as s')
			.innerJoin('subscription_tier as st_next', 'st_next.id', 's.next_tier_id')
			.innerJoin('subscription_tier as st_curr', 'st_curr.id', 's.current_tier_id')
			.selectAll('s')
			.select(['st_next.power as st_next_power', 'st_next.price_rubles as st_next_price'])
			.select(['st_curr.power as st_curr_power', 'st_curr.price_rubles as st_curr_price'])
			.where('user_id', '=', userId)
			.limit(1)
			.executeTakeFirst();

		if (!res) {
			return undefined;
		}

		const { st_curr_power, st_curr_price, st_next_power, st_next_price, ...subscription } = res;

		return {
			subscription,
			currentTier: {
				power: st_curr_power,
				price: st_curr_price,
			},
			nextTier: {
				power: st_next_power,
				price: st_next_price,
			},
		};
	}

	async lockSubscriptionByUserId(
		userId: Subscription['user_id'],
		trx: SubscriptionTransaction,
	): Promise<PaidAndGiftedSubPerUserView | undefined> {
		const sub = await trx
			.selectFrom('subscription as s')
			.innerJoin('subscription_tier as st', 'st.id', 's.current_tier_id')
			.innerJoin('subscription_tier as st_next', 'st_next.id', 's.next_tier_id')
			.leftJoinLateral(
				eb =>
					eb
						.selectFrom('gift')
						.innerJoin('subscription_tier as st', 'st.id', 'gift.tier_id')
						.select(['gift.id', 'gift.tier_id as gifted_tier_id', 'st.power as gifted_tier_power'])
						.select(({}) => [
							sql<number>`CEIL(EXTRACT(EPOCH FROM((gift.activated_at::timestamptz + (gift.duration_days || ' days')::interval) - now()::timestamptz)) / 86400)`.as(
								'gifted_days_left',
							),
						])
						.where('gift.activated_at', 'is not', null)
						.$narrowType<{ activated_at: NotNull }>()
						// this abomination checks if gift is active or not. Btw, we could use virtual computed columns from pg 18
						.whereRef('gifted_to', '=', 's.user_id')
						.where(
							sql`(now()::timestamptz - gift.activated_at::timestamptz)`,
							'<=',
							sql`(gift.duration_days || ' days')::interval`,
						)
						.limit(1)
						.as('g'),
				join => join.onTrue(),
			)
			.selectAll('s')
			.select([
				'st.id as paid_tier_id',
				'st.power as paid_tier_power',
				'st.permissions as paid_tier_permissions',
				'st.tier as paid_tier_name',
				'st.price_rubles as paid_tier_price',
			])
			.select([
				'st_next.id as paid_next_tier_id',
				'st_next.power as paid_next_tier_power',
				'st_next.permissions as paid_next_tier_permissions',
				'st_next.tier as paid_next_tier_name',
				'st_next.price_rubles as paid_next_tier_price',
			])
			.select(['g.id as gift_id', 'g.gifted_tier_id', 'g.gifted_days_left', 'g.gifted_tier_power'])
			.where('s.user_id', '=', userId)
			.forUpdate('s')
			.limit(1)
			.executeTakeFirst();

		if (!sub) {
			return undefined;
		}

		const {
			gift_id,
			gifted_tier_id,
			gifted_days_left,
			gifted_tier_power,
			paid_tier_id,
			paid_tier_name,
			paid_tier_permissions,
			paid_tier_power,
			paid_tier_price,
			paid_next_tier_id,
			paid_next_tier_name,
			paid_next_tier_permissions,
			paid_next_tier_power,
			paid_next_tier_price,
			...paidSubscriptionData
		} = sub;

		const currentlyActiveGift =
			gift_id !== null
				? {
						gift: {
							giftId: gift_id,
							giftedDaysLeft: gifted_days_left && gifted_days_left > 0 ? gifted_days_left : 0,
						},
						currentTier: {
							giftedTierId: gifted_tier_id!,
							giftedTierPower: gifted_tier_power!,
						},
					}
				: undefined;

		return {
			currentActiveGiftSubscription: currentlyActiveGift,
			currentPaidSubscription: {
				subscription: { ...paidSubscriptionData },
				currentTier: {
					id: paid_tier_id,
					tier: paid_tier_name,
					power: paid_tier_power,
					permissions: paid_tier_permissions,
					price_rubles: paid_tier_price,
				},
				nextTier: {
					id: paid_next_tier_id,
					tier: paid_next_tier_name,
					power: paid_next_tier_power,
					permissions: paid_next_tier_permissions,
					price_rubles: paid_next_tier_price,
				},
			},
		};
	}

	async getFullSubscriptionByUser(userId: Subscription['user_id']): Promise<FullSubscription | undefined> {
		const row = await this.db
			.selectFrom('subscription as s')
			.innerJoin('subscription_tier as st_curr', 'st_curr.id', 's.current_tier_id')
			.innerJoin('subscription_tier as st_next', 'st_next.id', 's.next_tier_id')
			.leftJoinLateral(
				eb =>
					eb
						.selectFrom('gift as g')
						.innerJoin('subscription_tier as st_gift', 'st_gift.id', 'g.tier_id')
						.select([
							'st_gift.id as gift_tier_id',
							'st_gift.tier as gift_tier_name',
							'st_gift.permissions as gift_tier_permissions',
							sql<Date>`g.activated_at::timestamptz + g.duration_days * interval '1 day'`.as('gift_tier_until'),
						])
						.where('g.activated_at', 'is not', null)
						.whereRef('g.gifted_to', '=', 's.user_id')
						.where(sql`g.activated_at::timestamptz + g.duration_days * interval '1 day'`, '>=', sql`now()::timestamptz`)
						.orderBy('st_gift.power', 'desc')
						.orderBy('g.activated_at', 'desc')
						.limit(1)
						.as('active_gift'),
				join => join.onTrue(),
			)
			.select([
				'st_curr.id as current_tier_id',
				'st_curr.tier as current_tier_name',
				'st_curr.permissions as current_tier_permissions',
				's.current_period_end as current_tier_until',
				'st_next.id as next_tier_id',
				'st_next.tier as next_tier_name',
				'st_next.permissions as next_tier_permissions',
				'st_next.price_rubles as next_payment_amount',
				's.current_period_end as next_payment_date',
				'active_gift.gift_tier_id',
				'active_gift.gift_tier_name',
				'active_gift.gift_tier_permissions',
				'active_gift.gift_tier_until',
			])
			.where('s.user_id', '=', userId)
			.limit(1)
			.executeTakeFirst();

		if (!row) {
			return undefined;
		}

		return {
			currentGiftTier: row.gift_tier_id
				? {
						id: row.gift_tier_id,
						name: row.gift_tier_name!,
						until: row.gift_tier_until!,
						permissions: row.gift_tier_permissions!,
					}
				: null,
			currentTier: {
				id: row.current_tier_id,
				name: row.current_tier_name,
				until: row.current_tier_until,
				permissions: row.current_tier_permissions,
			},
			nextTier: {
				id: row.next_tier_id,
				name: row.next_tier_name,
				permissions: row.next_tier_permissions,
			},
			nextPayment: {
				amount: row.next_payment_amount,
				date: row.next_payment_date,
			},
		};
	}

	// TODO: use left join since user can be on paid tier but removed his payment method
	async findBillableSubscriptions(params: FindBillableSubscriptionsParams): Promise<BillableSubscriptionRow[]> {
		const executor = this.getExecutor(params.trx);
		const retryAfter = new Date(params.runDate.getTime() - params.retryWindowDays * MS_IN_DAY);
		const doNotChargeAfter = getStartOfDayUtc(params.runDate);

		let query = executor
			.selectFrom('subscription')
			.innerJoin('subscription_tier as st_next', 'st_next.id', 'subscription.next_tier_id')
			.innerJoin('payment_method', 'payment_method.user_id', 'subscription.user_id')
			.selectAll('subscription')
			.select(eb => [eb.ref('payment_method.payment_method_id').as('billing_payment_method_id')])
			.where('payment_method.status', '=', 'active')
			.where('st_next.power', '<>', 0)
			.where('subscription.billing_period_days', '>', 0)
			.where(eb =>
				eb('subscription.current_period_end', 'is not', null).and(
					'subscription.current_period_end',
					'<',
					doNotChargeAfter,
				),
			)
			.where(eb =>
				eb('subscription.last_billing_attempt', 'is', null).or('subscription.last_billing_attempt', '<=', retryAfter),
			);

		if (params.cursor) {
			const cursorDate = params.cursor.currentPeriodEnd ?? new Date(0);
			query = query.where(
				sql<boolean>`(COALESCE(subscription.current_period_end, to_timestamp(0)), subscription.id) > (${cursorDate}, ${params.cursor.id})`,
			);
		}

		query = query
			.orderBy('subscription.current_period_end', 'asc')
			.orderBy('subscription.id', 'asc')
			.limit(params.limit);

		return await query.execute();
	}

	async findDowngradeCandidateSubscriptions(
		params: FindDowngradeCandidateSubscriptionsParams,
	): Promise<DowngradeCandidateSubscriptionRow[]> {
		const executor = this.getExecutor(params.trx);
		const retryAfter = new Date(params.runDate.getTime() - params.retryWindowDays * MS_IN_DAY);
		const doNotChargeAfter = getStartOfDayUtc(params.runDate);

		/*
			next_tier is not free AND no active payment_method (null || !active)
			or next_tier is free
		 */
		let query = executor
			.selectFrom('subscription')
			.innerJoin('subscription_tier as st_next', 'st_next.id', 'subscription.next_tier_id')
			.leftJoin('payment_method as pm', 'pm.user_id', 'subscription.user_id')
			.selectAll('subscription')
			.select(eb => eb('st_next.power', '=', 0).as('nextTierIsFree'))
			.$narrowType<{
				nextTierIsFree: boolean;
			}>()
			.select(eb => [eb.ref('pm.payment_method_id').as('billingPaymentMethodId')])
			.where(eb =>
				eb.or([
					eb.or([eb('pm.id', 'is', null), eb('pm.status', '<>', 'active')]).and('st_next.power', '<>', 0),
					eb('st_next.power', '=', 0),
				]),
			)
			.where('subscription.billing_period_days', '>', 0)
			.where(eb =>
				eb('subscription.current_period_end', 'is not', null).and(
					'subscription.current_period_end',
					'<',
					doNotChargeAfter,
				),
			)
			.where(eb =>
				eb('subscription.last_billing_attempt', 'is', null).or('subscription.last_billing_attempt', '<=', retryAfter),
			);

		if (params.cursor) {
			const cursorDate = params.cursor.currentPeriodEnd ?? new Date(0);
			query = query.where(
				sql<boolean>`(COALESCE(subscription.current_period_end, to_timestamp(0)), subscription.id) > (${cursorDate}, ${params.cursor.id})`,
			);
		}

		query = query
			.orderBy('subscription.current_period_end', 'asc')
			.orderBy('subscription.id', 'asc')
			.limit(params.limit);

		return await query.execute();
	}

	// TODO: type this bad boy up. event.event is a yookassa thing, event.type is our thing
	async insertPaymentEvent(data: NewPaymentEvent, trx?: SubscriptionTransaction): Promise<void> {
		const executor = this.getExecutor(trx);
		await executor.insertInto('payment_event').values(data).returningAll().executeTakeFirstOrThrow();
	}

	async upsertPaymentMethod(
		data: Pick<NewPaymentMethod, 'user_id' | 'payment_method_id' | 'status'>,
		trx?: SubscriptionTransaction,
	): Promise<PaymentMethod> {
		const executor = this.getExecutor(trx);
		const status: PaymentMethodStatus = data.status ?? 'pending';

		const existingByPaymentMethodId = await executor
			.selectFrom('payment_method')
			.selectAll()
			.where('payment_method_id', '=', data.payment_method_id)
			.limit(1)
			.executeTakeFirst();

		if (existingByPaymentMethodId) {
			if (existingByPaymentMethodId.status === status) {
				return existingByPaymentMethodId;
			}

			return await executor
				.updateTable('payment_method')
				.set({
					status,
					updated_at: sql`now()`,
				})
				.where('id', '=', existingByPaymentMethodId.id)
				.returningAll()
				.executeTakeFirstOrThrow();
		}

		if (status === 'pending') {
			const existingPending = await executor
				.selectFrom('payment_method')
				.select(['id'])
				.where('user_id', '=', data.user_id)
				.where('status', '=', 'pending')
				.limit(1)
				.executeTakeFirst();

			if (existingPending) {
				return await executor
					.updateTable('payment_method')
					.set({
						payment_method_id: data.payment_method_id,
						updated_at: sql`now()`,
					})
					.where('id', '=', existingPending.id)
					.returningAll()
					.executeTakeFirstOrThrow();
			}
		} else if (status === 'active') {
			await executor
				.deleteFrom('payment_method')
				.where('user_id', '=', data.user_id)
				.where('status', '=', 'active')
				.execute();
		}

		return await executor
			.insertInto('payment_method')
			.values({
				user_id: data.user_id,
				payment_method_id: data.payment_method_id,
				status,
			})
			.returningAll()
			.executeTakeFirstOrThrow();
	}

	async findPaymentMethodByPaymentMethodId(
		paymentMethodId: PaymentMethod['payment_method_id'],
		trx?: SubscriptionTransaction,
	): Promise<PaymentMethod | undefined> {
		const executor = this.getExecutor(trx);
		return await executor
			.selectFrom('payment_method')
			.selectAll()
			.where('payment_method_id', '=', paymentMethodId)
			.limit(1)
			.executeTakeFirst();
	}

	async updatePaymentMethodStatus(
		paymentMethodId: PaymentMethod['payment_method_id'],
		status: PaymentMethodStatus,
		trx?: SubscriptionTransaction,
	): Promise<PaymentMethod | undefined> {
		const executor = this.getExecutor(trx);
		return await executor
			.updateTable('payment_method')
			.set({
				status,
				updated_at: sql`now()`,
			})
			.where('payment_method_id', '=', paymentMethodId)
			.returningAll()
			.executeTakeFirst();
	}

	async findPaymentMethodByUserId(
		userId: PaymentMethod['user_id'],
		trx?: SubscriptionTransaction,
		options?: { status?: PaymentMethodStatus },
	): Promise<PaymentMethod | undefined> {
		const executor = this.getExecutor(trx);
		let query = executor.selectFrom('payment_method').selectAll().where('user_id', '=', userId).limit(1);

		if (options?.status) {
			query = query.where('status', '=', options.status);
		} else {
			query = query.orderBy(sql`CASE WHEN status = 'active' THEN 0 ELSE 1 END`).orderBy('created_at', 'desc');
		}

		return await query.executeTakeFirst();
	}

	async deletePaymentMethodsExcept(
		userId: PaymentMethod['user_id'],
		paymentMethodId: PaymentMethod['payment_method_id'],
		trx?: SubscriptionTransaction,
		options?: { status?: PaymentMethodStatus },
	): Promise<void> {
		const executor = this.getExecutor(trx);
		let query = executor
			.deleteFrom('payment_method')
			.where('user_id', '=', userId)
			.where('payment_method_id', '!=', paymentMethodId);

		if (options?.status) {
			query = query.where('status', '=', options.status);
		}

		await query.execute();
	}

	async deletePaymentMethodByUserId(userId: PaymentMethod['user_id'], trx?: SubscriptionTransaction): Promise<void> {
		const executor = this.getExecutor(trx);
		await executor.deleteFrom('payment_method').where('user_id', '=', userId).execute();
	}
}
