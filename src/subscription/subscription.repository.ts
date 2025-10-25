import { Inject, Injectable } from '@nestjs/common';
import { Kysely, Transaction, sql } from 'kysely';
import { DatabaseProvider } from '../infra/db/db.provider';
import {
	NewPaymentEvent,
	NewSubscription,
	PaymentEvent,
	PaymentEventTable,
	PaymentMethod,
	Subscription,
	SubscriptionAggregation,
	SubscriptionUpdate,
} from './subscription.entity';
import { UserAggregation } from '../user/user.entity';

export type SubscriptionDatabase = SubscriptionAggregation &
	UserAggregation & {
		payment_event: PaymentEventTable;
	};

export type SubscriptionTransaction = Transaction<SubscriptionDatabase>;

type SubscriptionQueryExecutor = Kysely<SubscriptionDatabase> | SubscriptionTransaction;

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

	async lockById(id: string, trx: SubscriptionTransaction): Promise<Subscription | undefined> {
		return await trx
			.selectFrom('subscription')
			.selectAll()
			.where('id', '=', id)
			.forUpdate()
			.limit(1)
			.executeTakeFirst();
	}

	async insertPaymentEvent(data: NewPaymentEvent, trx?: SubscriptionTransaction): Promise<PaymentEvent> {
		const executor = this.getExecutor(trx);
		return await executor.insertInto('payment_event').values(data).returningAll().executeTakeFirstOrThrow();
	}

	async upsertPaymentMethod(
		params: { userId: string; paymentMethodId: string },
		trx?: SubscriptionTransaction,
	): Promise<PaymentMethod> {
		const executor = this.getExecutor(trx);
		return await executor
			.insertInto('payment_method')
			.values({
				user_id: params.userId,
				payment_method_id: params.paymentMethodId,
			})
			.onConflict(oc =>
				oc.column('user_id').doUpdateSet({
					payment_method_id: params.paymentMethodId,
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
}
