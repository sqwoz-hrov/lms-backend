import { Kysely } from 'kysely';
import { DatabaseProvider } from '../../infra/db/db.provider';
import {
	NewSubscription,
	PaymentEvent,
	PaymentEventTable,
	Subscription,
	PaymentMethod,
	PaymentMethodTable,
	PaymentMethodType,
	SubscriptionTable,
} from '../subscription.entity';

type SubscriptionTestDb = {
	subscription: SubscriptionTable;
	payment_event: PaymentEventTable;
	payment_method: PaymentMethodTable;
};

export class SubscriptionTestRepository {
	private readonly connection: Kysely<SubscriptionTestDb>;

	constructor(dbProvider: DatabaseProvider) {
		this.connection = dbProvider.getDatabase<SubscriptionTestDb>();
	}

	async clearAll(): Promise<void> {
		await this.connection.deleteFrom('payment_method').execute();
		await this.connection.deleteFrom('payment_event').execute();
		await this.connection.deleteFrom('subscription').execute();
	}

	async insert(data: NewSubscription): Promise<Subscription> {
		return await this.connection.insertInto('subscription').values(data).returningAll().executeTakeFirstOrThrow();
	}

	async findById(id: string): Promise<Subscription | undefined> {
		return await this.connection
			.selectFrom('subscription')
			.selectAll()
			.where('id', '=', id)
			.limit(1)
			.executeTakeFirst();
	}

	async findPaymentEvents(filter?: { subscriptionId?: string }): Promise<PaymentEvent[]> {
		let query = this.connection.selectFrom('payment_event').selectAll().orderBy('created_at', 'desc');
		if (filter?.subscriptionId) {
			query = query.where('subscription_id', '=', filter.subscriptionId);
		}
		return await query.execute();
	}

	async upsertPaymentMethod(params: {
		userId: string;
		paymentMethodId: string;
		type?: PaymentMethodType;
		last4?: string | null;
	}): Promise<void> {
		const type = params.type ?? 'bank_card';
		const normalizedLast4 = type === 'bank_card' ? (params.last4 ?? null) : null;

		await this.connection
			.insertInto('payment_method')
			.values({
				user_id: params.userId,
				payment_method_id: params.paymentMethodId,
				type,
				last4: normalizedLast4,
			})
			.onConflict(oc =>
				oc.column('user_id').doUpdateSet({
					payment_method_id: params.paymentMethodId,
					type,
					last4: normalizedLast4,
				}),
			)
			.execute();
	}

	async findPaymentMethod(userId: string): Promise<PaymentMethod | undefined> {
		return await this.connection
			.selectFrom('payment_method')
			.selectAll()
			.where('user_id', '=', userId)
			.limit(1)
			.executeTakeFirst();
	}
}
