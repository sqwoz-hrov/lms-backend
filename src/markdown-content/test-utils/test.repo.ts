import { Kysely } from 'kysely';
import { DatabaseProvider } from '../../infra/db/db.provider';
import { MarkDownContentAggregation } from '../markdown-content.entity';

// use a sqlite driver for unit testing and actual
// provider for integration / e2e testing
export class MarkDownContentTestRepository {
	private readonly _connection: Kysely<MarkDownContentAggregation>;

	constructor(dbProvider: DatabaseProvider) {
		this._connection = dbProvider.getDatabase<MarkDownContentAggregation>();
	}

	get connection(): Kysely<MarkDownContentAggregation> {
		return this._connection;
	}

	async clearAll(): Promise<void> {
		await this._connection.deleteFrom('markdown_content').execute();
	}
}
