import { Kysely, sql } from 'kysely';
import { DatabaseProvider } from '../../infra/db/db.provider';
import {
	NewSubscription,
	PaymentEvent,
	PaymentEventTable,
	Subscription,
	PaymentMethod,
	PaymentMethodTable,
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

	async addPaymentMethod(params: {
		userId: string;
		paymentMethodId: string;
		status?: PaymentMethod['status'];
	}): Promise<void> {
		await this.connection
			.deleteFrom('payment_method')
			.where('payment_method_id', '=', params.paymentMethodId)
			.execute();

		await this.connection
			.insertInto('payment_method')
			.values({
				user_id: params.userId,
				payment_method_id: params.paymentMethodId,
				status: params.status ?? 'active',
			})
			.execute();
	}

	async addActivePaymentMethod(params: { userId: string; paymentMethodId: string }): Promise<void> {
		await this.addPaymentMethod({ ...params, status: 'active' });
	}

	async addPendingPaymentMethod(params: { userId: string; paymentMethodId: string }): Promise<void> {
		await this.addPaymentMethod({ ...params, status: 'pending' });
	}

	async findPaymentMethod(userId: string): Promise<PaymentMethod | undefined> {
		return await this.connection
			.selectFrom('payment_method')
			.selectAll()
			.where('user_id', '=', userId)
			.orderBy(sql`CASE WHEN status = 'active' THEN 0 ELSE 1 END`, 'asc')
			.orderBy('created_at', 'desc')
			.limit(1)
			.executeTakeFirst();
	}

	async findPaymentMethods(userId: string): Promise<PaymentMethod[]> {
		return await this.connection
			.selectFrom('payment_method')
			.selectAll()
			.where('user_id', '=', userId)
			.orderBy('created_at', 'asc')
			.execute();
	}
}
