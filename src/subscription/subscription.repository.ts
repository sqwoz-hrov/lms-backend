import { Inject, Injectable } from '@nestjs/common';
import { Kysely, Transaction, sql } from 'kysely';
import { DatabaseProvider } from '../infra/db/db.provider';
import { UserAggregation } from '../user/user.entity';
import type { BillableSubscriptionCursor, SubscriptionRepositoryPort } from './ports/subscription-repository.port';
import {
	NewPaymentEvent,
	NewPaymentMethod,
	NewSubscription,
	PaymentEventTable,
	PaymentMethod,
	PaymentMethodStatus,
	Subscription,
	SubscriptionAggregation,
	SubscriptionUpdate,
} from './subscription.entity';
import { getStartOfDayUtc } from './utils/get-start-of-day-utc';
import { MS_IN_DAY } from './constants';

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

export type BillableSubscriptionRow = Subscription & {
	billing_payment_method_id: PaymentMethod['payment_method_id'];
};

@Injectable()
export class SubscriptionRepository implements SubscriptionRepositoryPort<SubscriptionTransaction> {
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

	async create(data: NewSubscription, trx?: SubscriptionTransaction): Promise<Subscription> {
		const executor = this.getExecutor(trx);
		return await executor
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

	async deleteById(id: Subscription['id'], trx?: SubscriptionTransaction): Promise<void> {
		const executor = this.getExecutor(trx);
		await executor.deleteFrom('subscription').where('id', '=', id).execute();
	}

	async findById(id: Subscription['id'], trx?: SubscriptionTransaction): Promise<Subscription | undefined> {
		const executor = this.getExecutor(trx);
		return await executor.selectFrom('subscription').selectAll().where('id', '=', id).limit(1).executeTakeFirst();
	}

	async findByUserId(
		userId: Subscription['user_id'],
		trx?: SubscriptionTransaction,
	): Promise<Subscription | undefined> {
		const executor = this.getExecutor(trx);
		return await executor
			.selectFrom('subscription')
			.selectAll()
			.where('user_id', '=', userId)
			.limit(1)
			.executeTakeFirst();
	}

	async lockByUserId(userId: Subscription['user_id'], trx: SubscriptionTransaction): Promise<Subscription | undefined> {
		return await trx
			.selectFrom('subscription')
			.selectAll()
			.where('user_id', '=', userId)
			.forUpdate()
			.limit(1)
			.executeTakeFirst();
	}

	async findBillableSubscriptions(params: FindBillableSubscriptionsParams): Promise<BillableSubscriptionRow[]> {
		const executor = this.getExecutor(params.trx);
		const retryAfter = new Date(params.runDate.getTime() - params.retryWindowDays * MS_IN_DAY);
		const billingThreshold = getStartOfDayUtc(params.runDate);

		let query = executor
			.selectFrom('subscription')
			.innerJoin('payment_method', 'payment_method.user_id', 'subscription.user_id')
			.selectAll('subscription')
			.select(eb => [eb.ref('payment_method.payment_method_id').as('billing_payment_method_id')])
			.where('payment_method.status', '=', 'active')
			.where('subscription.is_gifted', '=', false)
			.where('subscription.billing_period_days', '>', 0)
			.where(
				sql<boolean>`(subscription.current_period_end IS NULL OR subscription.current_period_end < ${billingThreshold})`,
			)
			.where(
				sql<boolean>`(subscription.last_billing_attempt IS NULL OR subscription.last_billing_attempt <= ${retryAfter})`,
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

		return await executor
			.insertInto('payment_method')
			.values({
				user_id: data.user_id,
				payment_method_id: data.payment_method_id,
				status,
			})
			.onConflict(oc =>
				oc.column('user_id').doUpdateSet({
					payment_method_id: data.payment_method_id,
					status,
					updated_at: sql`now()`,
				}),
			)
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
		}

		return await query.executeTakeFirst();
	}

	async deletePaymentMethodByUserId(userId: PaymentMethod['user_id'], trx?: SubscriptionTransaction): Promise<void> {
		const executor = this.getExecutor(trx);
		await executor.deleteFrom('payment_method').where('user_id', '=', userId).execute();
	}
}
