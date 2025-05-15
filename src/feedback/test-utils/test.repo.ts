import { Kysely } from 'kysely';
import { FeedbackAggregation } from '../feedback.entity';
import { DatabaseProvider } from '../../infra/db/db.provider';

// use a sqlite driver for unit testing and actual
// provider for integration / e2e testing
export class FeedbacksTestRepository {
	private readonly _connection: Kysely<FeedbackAggregation>;

	constructor(dbProvider: DatabaseProvider) {
		this._connection = dbProvider.getDatabase<FeedbackAggregation>();
	}

	get connection(): Kysely<FeedbackAggregation> {
		return this._connection;
	}

	async clearAll(): Promise<void> {
		await this._connection.deleteFrom('feedback').execute();
	}
}
