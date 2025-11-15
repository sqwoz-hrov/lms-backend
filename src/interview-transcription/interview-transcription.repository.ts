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

	async updateStatus(
		id: string,
		status: InterviewTranscriptionStatus,
		extraUpdates: Partial<InterviewTranscriptionUpdate> = {},
	): Promise<InterviewTranscription | undefined> {
		return await this.connection
			.updateTable('interview_transcription')
			.set({ status, ...extraUpdates })
			.where('id', '=', id)
			.returningAll()
			.executeTakeFirst();
	}

	async markProcessing(id: string): Promise<InterviewTranscription | undefined> {
		return await this.connection
			.updateTable('interview_transcription')
			.set({ status: 'processing' })
			.where('id', '=', id)
			.where('status', '=', 'created')
			.returningAll()
			.executeTakeFirst();
	}

	async markDone(id: string, s3TranscriptionKey: string): Promise<InterviewTranscription | undefined> {
		return await this.connection
			.updateTable('interview_transcription')
			.set({ status: 'done', s3_transcription_key: s3TranscriptionKey })
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
