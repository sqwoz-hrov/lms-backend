import { Inject } from '@nestjs/common';
import { Kysely, sql } from 'kysely';
import { DatabaseProvider } from '../infra/db/db.provider';
import { NewVideo, UploadedRange, UploadPhase, Video, VideoAggregation, VideoTable, VideoUpdate } from './video.entity';

export class VideoRepository {
	private readonly connection: Kysely<VideoAggregation>;

	constructor(@Inject(DatabaseProvider) dbProvider: DatabaseProvider) {
		this.connection = dbProvider.getDatabase<VideoAggregation>();
	}

	async save(
		data: Omit<
			NewVideo,
			| 'updated_at'
			| 'version'
			| 'uploaded_ranges'
			| 'upload_offset'
			| 'transcription_audio_storage_key'
			| 'workflow_retry_count'
		>,
	): Promise<Video> {
		return await this.connection.transaction().execute(async trx => {
			const res = await trx
				.insertInto('video')
				.values({
					...data,
					uploaded_ranges: [],
					upload_offset: String(0),
					transcription_audio_storage_key: null,
					workflow_retry_phase: null,
					workflow_retry_count: 0,
					workflow_last_error: null,
					workflow_last_error_at: null,
					upload_failed_phase: null,
					upload_failed_reason: null,
					upload_failed_at: null,
				})
				.returningAll()
				.executeTakeFirstOrThrow();
			return res;
		});
	}

	async update(id: string, updates: VideoUpdate): Promise<Video | undefined> {
		return await this.connection.transaction().execute(async trx => {
			const locked = await trx
				.selectFrom('video')
				.selectAll()
				.where('id', '=', id)
				.forUpdate()
				.limit(1)
				.executeTakeFirst();

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

	async setPhase(
		id: string,
		phase: VideoTable['phase'],
		options?: {
			clearWorkflowFailureState?: boolean;
			clearTerminalFailureState?: boolean;
		},
	): Promise<Video> {
		return await this.connection.transaction().execute(async trx => {
			// Acquire pessimistic lock
			const existing = await trx
				.selectFrom('video')
				.selectAll()
				.where('id', '=', id)
				.forUpdate()
				.limit(1)
				.executeTakeFirst();

			if (!existing) {
				throw new Error('Session not found');
			}

			const updates: VideoUpdate = { phase };
			if (options?.clearWorkflowFailureState) {
				updates.workflow_retry_phase = null;
				updates.workflow_retry_count = 0;
				updates.workflow_last_error = null;
				updates.workflow_last_error_at = null;
			}
			if (options?.clearTerminalFailureState) {
				updates.upload_failed_phase = null;
				updates.upload_failed_reason = null;
				updates.upload_failed_at = null;
			}

			const resWithState = await trx
				.updateTable('video')
				.set(updates)
				.where('id', '=', id)
				.returningAll()
				.executeTakeFirst();

			if (!resWithState) {
				throw new Error('Concurrent update (phase)');
			}

			return resWithState;
		});
	}

	async recordWorkflowFailure(id: string, phase: UploadPhase, errorMessage: string): Promise<Video> {
		return await this.connection.transaction().execute(async trx => {
			const existing = await trx
				.selectFrom('video')
				.selectAll()
				.where('id', '=', id)
				.forUpdate()
				.limit(1)
				.executeTakeFirst();

			if (!existing) {
				throw new Error('Session not found');
			}

			const nextRetryCount = existing.workflow_retry_phase === phase ? existing.workflow_retry_count + 1 : 1;

			const res = await trx
				.updateTable('video')
				.set({
					workflow_retry_phase: phase,
					workflow_retry_count: nextRetryCount,
					workflow_last_error: errorMessage,
					workflow_last_error_at: new Date(),
				})
				.where('id', '=', id)
				.returningAll()
				.executeTakeFirst();

			if (!res) {
				throw new Error('Concurrent update (workflow_failure)');
			}

			return res;
		});
	}

	async markUploadFailedTerminal(id: string, failedPhase: UploadPhase, reason: string): Promise<Video> {
		return await this.connection.transaction().execute(async trx => {
			const existing = await trx
				.selectFrom('video')
				.selectAll()
				.where('id', '=', id)
				.forUpdate()
				.limit(1)
				.executeTakeFirst();

			if (!existing) {
				throw new Error('Session not found');
			}

			const failedAt = new Date();
			const res = await trx
				.updateTable('video')
				.set({
					phase: 'failed',
					upload_failed_phase: failedPhase,
					upload_failed_reason: reason,
					upload_failed_at: failedAt,
					workflow_retry_phase: failedPhase,
					workflow_retry_count:
						existing.workflow_retry_phase === failedPhase
							? existing.workflow_retry_count
							: Math.max(1, existing.workflow_retry_count),
					workflow_last_error: reason,
					workflow_last_error_at: failedAt,
				})
				.where('id', '=', id)
				.returningAll()
				.executeTakeFirst();

			if (!res) {
				throw new Error('Concurrent update (mark_upload_failed_terminal)');
			}

			return res;
		});
	}

	async setChecksum(id: string, checksum_sha256_base64: VideoTable['checksum_sha256_base64']): Promise<Video> {
		return await this.connection.transaction().execute(async trx => {
			// Acquire pessimistic lock
			const existing = await trx
				.selectFrom('video')
				.selectAll()
				.where('id', '=', id)
				.forUpdate()
				.limit(1)
				.executeTakeFirst();

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
			const existing = await trx
				.selectFrom('video')
				.selectAll()
				.where('id', '=', id)
				.forUpdate()
				.limit(1)
				.executeTakeFirst();

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
		return await this.connection.selectFrom('video').selectAll().where('id', '=', id).limit(1).executeTakeFirst();
	}

	async find(filter: Partial<Video> = {}): Promise<Video[]> {
		let query = this.connection.selectFrom('video').selectAll();
		for (const key in filter) {
			query = query.where(key as keyof typeof filter, '=', filter[key]);
		}
		return await query.execute();
	}
}
