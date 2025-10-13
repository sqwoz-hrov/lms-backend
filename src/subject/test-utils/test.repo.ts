import { Kysely } from 'kysely';
import { DatabaseProvider } from '../../infra/db/db.provider';
import { SubjectAggregation } from '../subject.entity';

// use a sqlite driver for unit testing and actual
// provider for integration / e2e testing
export class SubjectsTestRepository {
	private readonly _connection: Kysely<SubjectAggregation>;

	constructor(dbProvider: DatabaseProvider) {
		this._connection = dbProvider.getDatabase<SubjectAggregation>();
	}

	get connection(): Kysely<SubjectAggregation> {
		return this._connection;
	}

	async clearAll(): Promise<void> {
		await this._connection.deleteFrom('subject_tier').execute();
		await this._connection.deleteFrom('subject').execute();
	}
}
