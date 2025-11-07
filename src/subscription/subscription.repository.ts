import { Inject, Injectable } from '@nestjs/common';
import { Kysely, Transaction, sql } from 'kysely';
import { DatabaseProvider } from '../infra/db/db.provider';
import { UserAggregation } from '../user/user.entity';
import {
	NewPaymentEvent,
	NewSubscription,
	PaymentEvent,
	PaymentEventTable,
	PaymentMethod,
	PaymentMethodType,
	Subscription,
	SubscriptionAggregation,
	SubscriptionUpdate,
} from './subscription.entity';

export type SubscriptionDatabase = SubscriptionAggregation &
	UserAggregation & {
		payment_event: PaymentEventTable;
	};

export type SubscriptionTransaction = Transaction<SubscriptionDatabase>;

type SubscriptionQueryExecutor = Kysely<SubscriptionDatabase> | SubscriptionTransaction;

const MS_IN_DAY = 24 * 60 * 60 * 1000;

type UpsertPaymentMethodParams = {
	user_id: string;
	payment_method_id: string;
	type: PaymentMethodType;
	last4?: string | null;
};

type FindBillableSubscriptionsParams = {
	runDate: Date;
	leadTimeDays: number;
	retryWindowDays: number;
	limit: number;
	trx?: SubscriptionTransaction;
};

export type BillableSubscriptionRow = Subscription & {
	billing_payment_method_id: string;
	billing_payment_method_type: PaymentMethodType;
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

	async update(id: string, data: SubscriptionUpdate, trx?: SubscriptionTransaction): Promise<Subscription | undefined> {
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

	async deleteById(id: string, trx?: SubscriptionTransaction): Promise<void> {
		const executor = this.getExecutor(trx);
		await executor.deleteFrom('subscription').where('id', '=', id).execute();
	}

	async findById(id: string, trx?: SubscriptionTransaction): Promise<Subscription | undefined> {
		const executor = this.getExecutor(trx);
		return await executor.selectFrom('subscription').selectAll().where('id', '=', id).limit(1).executeTakeFirst();
	}

	async findByUserId(userId: string, trx?: SubscriptionTransaction): Promise<Subscription | undefined> {
		const executor = this.getExecutor(trx);
		return await executor
			.selectFrom('subscription')
			.selectAll()
			.where('user_id', '=', userId)
			.limit(1)
			.executeTakeFirst();
	}

	async lockByUserId(user_id: string, trx: SubscriptionTransaction): Promise<Subscription | undefined> {
		return await trx
			.selectFrom('subscription')
			.selectAll()
			.where('user_id', '=', user_id)
			.forUpdate()
			.limit(1)
			.executeTakeFirst();
	}

	async findBillableSubscriptions(params: FindBillableSubscriptionsParams): Promise<BillableSubscriptionRow[]> {
		const executor = this.getExecutor(params.trx);
		const chargeBefore = new Date(params.runDate.getTime() + params.leadTimeDays * MS_IN_DAY);
		const retryAfter = new Date(params.runDate.getTime() - params.retryWindowDays * MS_IN_DAY);

		return await executor
			.selectFrom('subscription')
			.innerJoin('payment_method', 'payment_method.user_id', 'subscription.user_id')
			.selectAll('subscription')
			.select(eb => [
				eb.ref('payment_method.payment_method_id').as('billing_payment_method_id'),
				eb.ref('payment_method.type').as('billing_payment_method_type'),
			])
			.where('subscription.is_gifted', '=', false)
			.where('subscription.billing_period_days', '>', 0)
			.where(
				sql<boolean>`(subscription.current_period_end IS NULL OR subscription.current_period_end <= ${chargeBefore})`,
			)
			.where(
				sql<boolean>`(subscription.last_billing_attempt IS NULL OR subscription.last_billing_attempt <= ${retryAfter})`,
			)
			.orderBy('subscription.current_period_end', 'asc')
			.limit(params.limit)
			.execute();
	}

	async insertPaymentEvent(data: NewPaymentEvent, trx?: SubscriptionTransaction): Promise<PaymentEvent> {
		const executor = this.getExecutor(trx);
		return await executor.insertInto('payment_event').values(data).returningAll().executeTakeFirstOrThrow();
	}

	async upsertPaymentMethod(params: UpsertPaymentMethodParams, trx?: SubscriptionTransaction): Promise<PaymentMethod> {
		const executor = this.getExecutor(trx);
		const normalizedLast4 = params.type === 'bank_card' ? (params.last4 ?? null) : null;

		return await executor
			.insertInto('payment_method')
			.values({
				user_id: params.user_id,
				payment_method_id: params.payment_method_id,
				type: params.type,
				last4: normalizedLast4,
			})
			.onConflict(oc =>
				oc.column('user_id').doUpdateSet({
					payment_method_id: params.payment_method_id,
					type: params.type,
					last4: normalizedLast4,
					updated_at: sql`now()`,
				}),
			)
			.returningAll()
			.executeTakeFirstOrThrow();
	}

	async findPaymentMethodByUserId(userId: string, trx?: SubscriptionTransaction): Promise<PaymentMethod | undefined> {
		const executor = this.getExecutor(trx);
		return await executor
			.selectFrom('payment_method')
			.selectAll()
			.where('user_id', '=', userId)
			.limit(1)
			.executeTakeFirst();
	}

	async deletePaymentMethodByUserId(userId: string, trx?: SubscriptionTransaction): Promise<void> {
		const executor = this.getExecutor(trx);
		await executor.deleteFrom('payment_method').where('user_id', '=', userId).execute();
	}
}
