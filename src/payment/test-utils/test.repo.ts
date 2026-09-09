import { Kysely } from 'kysely';
import { DatabaseProvider } from '../../infra/db/db.provider';
import { NewPaymentEvent, PaymentEvent, PaymentEventTable } from '../payment.entity';

type PaymentTestDb = {
	payment_event: PaymentEventTable;
};

export class PaymentTestRepository {
	private readonly connection: Kysely<PaymentTestDb>;

	constructor(dbProvider: DatabaseProvider) {
		this.connection = dbProvider.getDatabase<PaymentTestDb>();
	}

	async insertPaymentEvent(data: NewPaymentEvent): Promise<PaymentEvent> {
		return await this.connection.insertInto('payment_event').values(data).returningAll().executeTakeFirstOrThrow();
	}
}
