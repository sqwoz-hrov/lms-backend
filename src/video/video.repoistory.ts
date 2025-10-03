import { Inject } from '@nestjs/common';
import { Kysely, sql } from 'kysely';
import { DatabaseProvider } from '../infra/db/db.provider';
import { NewVideo, UploadedRange, Video, VideoAggregation, VideoTable, VideoUpdate } from './video.entity';

export class VideoRepository {
	private readonly connection: Kysely<VideoAggregation>;

	constructor(@Inject(DatabaseProvider) dbProvider: DatabaseProvider) {
		this.connection = dbProvider.getDatabase<VideoAggregation>();
	}

	async save(data: Omit<NewVideo, 'updated_at' | 'version' | 'uploaded_ranges' | 'upload_offset'>): Promise<Video> {
		return await this.connection.transaction().execute(async trx => {
			const res = await trx
				.insertInto('video')
				.values({
					user_id: data.user_id,
					filename: data.filename,
					mime_type: data.mime_type ?? null,
					total_size: data.total_size,
					chunk_size: data.chunk_size,
					tmp_path: data.tmp_path,
					phase: data.phase ?? 'receiving',
					uploaded_ranges: [],
					upload_offset: String(0),
				})
				.returningAll()
				.executeTakeFirstOrThrow();
			return res;
		});
	}

	async update(id: string, updates: VideoUpdate): Promise<Video | undefined> {
		return await this.connection.transaction().execute(async trx => {
			// Acquire pessimistic lock
			const locked = await trx.selectFrom('video').selectAll().where('id', '=', id).forUpdate().executeTakeFirst();

			if (!locked) {
				return undefined;
			}

			const uploadedRangesUpdates = {
				uploaded_ranges: sql<UploadedRange[]>`${JSON.stringify(updates.uploaded_ranges)}`,
			};

			const res = await trx
				.updateTable('video')
				.set({
					...updates,
					...(updates.uploaded_ranges ? uploadedRangesUpdates : {}),
				})
				.where('id', '=', id)
				.returningAll()
				.executeTakeFirst();

			return res;
		});
	}

	async setPhase(id: string, phase: VideoTable['phase']): Promise<Video> {
		return await this.connection.transaction().execute(async trx => {
			// Acquire pessimistic lock
			const existing = await trx.selectFrom('video').selectAll().where('id', '=', id).forUpdate().executeTakeFirst();

			if (!existing) {
				throw new Error('Session not found');
			}

			const res = await trx.updateTable('video').set({ phase }).where('id', '=', id).returningAll().executeTakeFirst();

			if (!res) {
				throw new Error('Concurrent update (phase)');
			}

			return res;
		});
	}

	async setChecksum(id: string, checksum_sha256_base64: VideoTable['checksum_sha256_base64']): Promise<Video> {
		return await this.connection.transaction().execute(async trx => {
			// Acquire pessimistic lock
			const existing = await trx.selectFrom('video').selectAll().where('id', '=', id).forUpdate().executeTakeFirst();

			if (!existing) {
				throw new Error('Session not found');
			}

			const res = await trx
				.updateTable('video')
				.set({ checksum_sha256_base64 })
				.where('id', '=', id)
				.returningAll()
				.executeTakeFirst();

			if (!res) {
				throw new Error('Concurrent update (checksum)');
			}

			return res;
		});
	}

	async deleteById(id: string): Promise<void> {
		await this.connection.deleteFrom('video').where('id', '=', id).execute();
	}

	/**
	 * Атомарно фиксирует прогресс (offset + слитые диапазоны).
	 */
	async advanceProgress(id: string, nextOffset: number, mergedRanges: UploadedRange[]): Promise<Video> {
		return await this.connection.transaction().execute(async trx => {
			// Acquire pessimistic lock
			const existing = await trx.selectFrom('video').selectAll().where('id', '=', id).forUpdate().executeTakeFirst();

			if (!existing) {
				throw new Error('Session not found');
			}

			const uploadedRangesUpdates = {
				uploaded_ranges: sql<UploadedRange[]>`${JSON.stringify(mergedRanges)}`,
			};

			const res = await trx
				.updateTable('video')
				.set({
					upload_offset: String(nextOffset),
					...uploadedRangesUpdates,
				})
				.where('id', '=', id)
				.returningAll()
				.executeTakeFirst();

			if (!res) {
				throw new Error('Concurrent update (progress)');
			}

			return res;
		});
	}

	async findById(id: string): Promise<Video | undefined> {
		return await this.connection.selectFrom('video').selectAll().where('id', '=', id).executeTakeFirst();
	}

	async find(filter: Partial<Video> = {}): Promise<Video[]> {
		let query = this.connection.selectFrom('video').selectAll();
		for (const key in filter) {
			query = query.where(key as keyof typeof filter, '=', filter[key]);
		}
		return await query.execute();
	}
}
