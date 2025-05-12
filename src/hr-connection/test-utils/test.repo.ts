import { Kysely } from 'kysely';
import { HrConnectionAggregation } from '../hr-connection.entity';
import { DatabaseProvider } from '../../infra/db/db.provider';

// use a sqlite driver for unit testing and actual
// provider for integration / e2e testing
export class HrConnectionsTestRepository {
	private readonly _connection: Kysely<HrConnectionAggregation>;

	constructor(dbProvider: DatabaseProvider) {
		this._connection = dbProvider.getDatabase<HrConnectionAggregation>();
	}

	get connection(): Kysely<HrConnectionAggregation> {
		return this._connection;
	}

	async clearAll(): Promise<void> {
		await this._connection.deleteFrom('hr_connection').execute();
	}
}
