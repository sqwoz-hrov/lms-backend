import { Inject, Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { DatabaseProvider } from '../infra/db/db.provider';
import {
	InterviewTranscription,
	InterviewTranscriptionAggregation,
	InterviewTranscriptionStatus,
	InterviewTranscriptionUpdate,
	NewInterviewTranscription,
} from './interview-transcription.entity';
import { Video } from '../video/video.entity';

type InterviewTranscriptionVideoSummary = Pick<Video, 'id' | 'user_id' | 'filename' | 'mime_type' | 'created_at'>;

export type InterviewTranscriptionWithVideo = InterviewTranscription & {
	video: InterviewTranscriptionVideoSummary;
};

type InterviewTranscriptionWithVideoRow = InterviewTranscription & {
	video__id: string;
	video__user_id: string;
	video__filename: string;
	video__mime_type: string | null;
	video__created_at: Date;
};

@Injectable()
export class InterviewTranscriptionRepository {
	private readonly connection: Kysely<InterviewTranscriptionAggregation>;

	constructor(@Inject(DatabaseProvider) dbProvider: DatabaseProvider) {
		this.connection = dbProvider.getDatabase<InterviewTranscriptionAggregation>();
	}

	async create(data: NewInterviewTranscription): Promise<InterviewTranscription> {
		return await this.connection
			.insertInto('interview_transcription')
			.values(data)
			.returningAll()
			.executeTakeFirstOrThrow();
	}

	async findById(id: string): Promise<InterviewTranscription | undefined> {
		return await this.connection
			.selectFrom('interview_transcription')
			.selectAll()
			.where('id', '=', id)
			.limit(1)
			.executeTakeFirst();
	}

	async findLatestByVideoId(
		videoId: string,
		statuses?: InterviewTranscriptionStatus[],
	): Promise<InterviewTranscription | undefined> {
		let query = this.connection
			.selectFrom('interview_transcription')
			.selectAll()
			.where('video_id', '=', videoId)
			.orderBy('created_at', 'desc')
			.limit(1);

		if (statuses && statuses.length > 0) {
			query = query.where('status', 'in', statuses);
		}

		return await query.executeTakeFirst();
	}

	async findByStatus(status: InterviewTranscriptionStatus): Promise<InterviewTranscription[]> {
		return await this.connection
			.selectFrom('interview_transcription')
			.selectAll()
			.where('status', '=', status)
			.execute();
	}

	async findAll(filters: { userId?: string } = {}): Promise<InterviewTranscriptionWithVideo[]> {
		let query = this.connection
			.selectFrom('interview_transcription')
			.innerJoin('video', 'video.id', 'interview_transcription.video_id')
			.selectAll('interview_transcription')
			.select([
				'video.id as video__id',
				'video.user_id as video__user_id',
				'video.filename as video__filename',
				'video.mime_type as video__mime_type',
				'video.created_at as video__created_at',
			])
			.orderBy('interview_transcription.created_at', 'desc');

		if (filters.userId) {
			query = query.where('video.user_id', '=', filters.userId);
		}

		const rows = (await query.execute()) as InterviewTranscriptionWithVideoRow[];
		return rows.map(row => this.mapWithVideo(row));
	}

	async findForUser(userId: string): Promise<InterviewTranscriptionWithVideo[]> {
		return await this.findAll({ userId });
	}

	private mapWithVideo(row: InterviewTranscriptionWithVideoRow): InterviewTranscriptionWithVideo {
		const { video__id, video__user_id, video__filename, video__mime_type, video__created_at, ...rest } = row;
		return {
			...(rest as InterviewTranscription),
			video: {
				id: video__id,
				user_id: video__user_id,
				filename: video__filename,
				mime_type: video__mime_type,
				created_at: video__created_at,
			},
		};
	}

	async updateStatus(
		id: string,
		status: InterviewTranscriptionStatus,
		extraUpdates: Partial<InterviewTranscriptionUpdate> = {},
	): Promise<InterviewTranscription | undefined> {
		return await this.connection
			.updateTable('interview_transcription')
			.set({
				status,
				...extraUpdates,
				updated_at: new Date(),
			})
			.where('id', '=', id)
			.returningAll()
			.executeTakeFirst();
	}

	async markProcessing(id: string): Promise<InterviewTranscription | undefined> {
		return await this.connection
			.updateTable('interview_transcription')
			.set({ status: 'processing', updated_at: new Date() })
			.where('id', '=', id)
			.where('status', '=', 'created')
			.returningAll()
			.executeTakeFirst();
	}

	async markDone(id: string, s3TranscriptionKey: string): Promise<InterviewTranscription | undefined> {
		return await this.connection
			.updateTable('interview_transcription')
			.set({ status: 'done', s3_transcription_key: s3TranscriptionKey, updated_at: new Date() })
			.where('id', '=', id)
			.returningAll()
			.executeTakeFirst();
	}

	async countByStatus(status: InterviewTranscriptionStatus): Promise<number> {
		const result = await this.connection
			.selectFrom('interview_transcription')
			.select(({ fn }) => fn.count<number>('id').as('count'))
			.where('status', '=', status)
			.limit(1)
			.executeTakeFirst();

		return Number(result?.count ?? 0);
	}
}
