import { Kysely } from 'kysely';
import { DatabaseProvider } from '../../infra/db/db.provider';
import { InterviewAggregation } from '../interview.entity';

// use a sqlite driver for unit testing and actual
// provider for integration / e2e testing
export class InterviewsTestRepository {
	private readonly _connection: Kysely<InterviewAggregation>;

	constructor(dbProvider: DatabaseProvider) {
		this._connection = dbProvider.getDatabase<InterviewAggregation>();
	}

	get connection(): Kysely<InterviewAggregation> {
		return this._connection;
	}

	async clearAll(): Promise<void> {
		await this._connection.deleteFrom('interview').execute();
	}
}
