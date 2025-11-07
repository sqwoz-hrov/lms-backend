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

type UpsertPaymentMethodParams = {
	user_id: string;
	payment_method_id: string;
	type: PaymentMethodType;
	last4?: string | null;
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
