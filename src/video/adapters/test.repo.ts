import { Kysely } from 'kysely';
import { DatabaseProvider } from '../../infra/db/db.provider';
import { VideoAggregation } from '../video.entity';

// use a sqlite driver for unit testing and actual
// provider for integration / e2e testing
export class JournalRecordsTestRepository {
	private readonly _connection: Kysely<VideoAggregation>;

	constructor(dbProvider: DatabaseProvider) {
		this._connection = dbProvider.getDatabase<VideoAggregation>();
	}

	get connection(): Kysely<VideoAggregation> {
		return this._connection;
	}

	async clearAll(): Promise<void> {
		await this._connection.deleteFrom('video').execute();
	}
}
