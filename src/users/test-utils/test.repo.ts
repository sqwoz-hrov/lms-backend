import { Kysely } from 'kysely';

import { UserAggregation } from '../user.entity';
import { DatabaseProvider } from '../../infra/db/db.provider';

// use a sqlite driver for unit testing and actual
// provider for integration / e2e testing
export class UsersTestRepository {
	private readonly _connection: Kysely<UserAggregation>;

	constructor(dbProvider: DatabaseProvider) {
		this._connection = dbProvider.getDatabase<UserAggregation>();
	}

	get connection(): Kysely<UserAggregation> {
		return this._connection;
	}

	async clearAll(): Promise<void> {
		await this._connection.deleteFrom('user').execute();
	}
}
