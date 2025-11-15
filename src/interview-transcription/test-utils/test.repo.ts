import { Kysely } from 'kysely';
import { DatabaseProvider } from '../../infra/db/db.provider';
import {
	InterviewTranscription,
	InterviewTranscriptionAggregation,
	InterviewTranscriptionStatus,
} from '../interview-transcription.entity';

export class InterviewTranscriptionsTestRepository {
	private readonly _connection: Kysely<InterviewTranscriptionAggregation>;

	constructor(dbProvider: DatabaseProvider) {
		this._connection = dbProvider.getDatabase<InterviewTranscriptionAggregation>();
	}

	get connection(): Kysely<InterviewTranscriptionAggregation> {
		return this._connection;
	}

	async clearAll(): Promise<void> {
		await this._connection.deleteFrom('interview_transcription').execute();
	}

	async findById(id: string): Promise<InterviewTranscription | undefined> {
		return await this._connection
			.selectFrom('interview_transcription')
			.selectAll()
			.where('id', '=', id)
			.limit(1)
			.executeTakeFirst();
	}

	async countByStatus(status: InterviewTranscriptionStatus): Promise<number> {
		const result = await this._connection
			.selectFrom('interview_transcription')
			.select(({ fn }) => fn.count<number>('id').as('count'))
			.where('status', '=', status)
			.limit(1)
			.executeTakeFirst();

		return Number(result?.count ?? 0);
	}
}
