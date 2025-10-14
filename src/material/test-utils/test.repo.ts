import { Kysely } from 'kysely';
import { DatabaseProvider } from '../../infra/db/db.provider';
import { MaterialAggregation } from '../material.entity';

// use a sqlite driver for unit testing and actual
// provider for integration / e2e testing
export class MaterialsTestRepository {
	private readonly _connection: Kysely<MaterialAggregation>;

	constructor(dbProvider: DatabaseProvider) {
		this._connection = dbProvider.getDatabase<MaterialAggregation>();
	}

	get connection(): Kysely<MaterialAggregation> {
		return this._connection;
	}

	async clearAll(): Promise<void> {
		await this._connection.deleteFrom('material_tier').execute();
		await this._connection.deleteFrom('material').execute();
	}
}
