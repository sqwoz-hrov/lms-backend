import { Kysely } from 'kysely';
import { DatabaseProvider } from '../../infra/db/db.provider';
import {
	NewSubscription,
	PaymentEvent,
	PaymentEventTable,
	Subscription,
	SubscriptionTable,
} from '../subscription.entity';

type SubscriptionTestDb = {
	subscription: SubscriptionTable;
	payment_event: PaymentEventTable;
};

export class SubscriptionTestRepository {
	private readonly connection: Kysely<SubscriptionTestDb>;

	constructor(dbProvider: DatabaseProvider) {
		this.connection = dbProvider.getDatabase<SubscriptionTestDb>();
	}

	async clearAll(): Promise<void> {
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
}
