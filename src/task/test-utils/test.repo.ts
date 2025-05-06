import { Kysely } from 'kysely';
import { DatabaseProvider } from '../../infra/db/db.provider';
import { TaskAggregation } from '../task.entity';

// use a sqlite driver for unit testing and actual
// provider for integration / e2e testing
export class TasksTestRepository {
	private readonly _connection: Kysely<TaskAggregation>;

	constructor(dbProvider: DatabaseProvider) {
		this._connection = dbProvider.getDatabase<TaskAggregation>();
	}

	get connection(): Kysely<TaskAggregation> {
		return this._connection;
	}

	async clearAll(): Promise<void> {
		await this._connection.deleteFrom('task').execute();
	}
}
