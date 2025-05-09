import { Inject } from '@nestjs/common';
import { Kysely } from 'kysely';
import { DatabaseProvider } from '../infra/db/db.provider';
import { NewVideo, Video, VideoAggregation, VideoUpdate } from './video.entity';

export class VideoRepository {
	private readonly connection: Kysely<VideoAggregation>;

	constructor(@Inject(DatabaseProvider) dbProvider: DatabaseProvider) {
		this.connection = dbProvider.getDatabase<VideoAggregation>();
	}

	async save(data: NewVideo): Promise<Video> {
		const res = await this.connection
			.insertInto('video')
			.values({ ...data })
			.returningAll()
			.executeTakeFirstOrThrow();

		return res;
	}

	async update(id: string, updates: VideoUpdate): Promise<Video> {
		const res = await this.connection
			.updateTable('video')
			.set(updates)
			.where('id', '=', id)
			.returningAll()
			.executeTakeFirstOrThrow();

		return res;
	}

	async findById(id: string): Promise<Video | undefined> {
		return await this.connection.selectFrom('video').selectAll().where('id', '=', id).executeTakeFirst();
	}

	async find(filter: Partial<Video> = {}): Promise<Video[]> {
		let query = this.connection.selectFrom('video').selectAll();
		for (const key in filter) {
			query = query.where(key as keyof typeof filter, '=', filter[key as keyof typeof filter]!);
		}
		return await query.execute();
	}
}
