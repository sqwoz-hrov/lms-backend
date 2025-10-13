import { Kysely } from 'kysely';
import { DatabaseProvider } from '../../infra/db/db.provider';
import { Video, VideoAggregation } from '../video.entity';

// use a sqlite driver for unit testing and actual
// provider for integration / e2e testing
export class VideosTestRepository {
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

	async findById(id: string): Promise<Video | undefined> {
		return this._connection.selectFrom('video').selectAll().where('id', '=', id).limit(1).executeTakeFirst();
	}
}
