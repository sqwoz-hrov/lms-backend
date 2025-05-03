import { Kysely } from 'kysely';

import { DatabaseProvider } from '../../infra/db/db.provider';
import { JournalRecordAggregation } from '../journal-record.entity';

// use a sqlite driver for unit testing and actual
// provider for integration / e2e testing
export class JournalRecordsTestRepository {
	private readonly _connection: Kysely<JournalRecordAggregation>;

	constructor(dbProvider: DatabaseProvider) {
		this._connection = dbProvider.getDatabase<JournalRecordAggregation>();
	}

	get connection(): Kysely<JournalRecordAggregation> {
		return this._connection;
	}

	async clearAll(): Promise<void> {
		await this._connection.deleteFrom('journal_record').execute();
	}
}
