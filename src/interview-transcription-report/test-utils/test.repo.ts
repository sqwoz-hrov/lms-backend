import { Kysely } from 'kysely';
import { DatabaseProvider } from '../../infra/db/db.provider';
import {
	InterviewTranscriptionReport,
	InterviewTranscriptionReportTable,
	NewInterviewTranscriptionReport,
} from '../interview-transcription-report.entity';

interface ReportDb {
	interview_transcription_report: InterviewTranscriptionReportTable;
}

export class InterviewTranscriptionReportTestRepository {
	private readonly _connection: Kysely<ReportDb>;

	constructor(dbProvider: DatabaseProvider) {
		this._connection = dbProvider.getDatabase<ReportDb>();
	}

	get connection(): Kysely<ReportDb> {
		return this._connection;
	}

	async clearAll(): Promise<void> {
		await this._connection.deleteFrom('interview_transcription_report').execute();
	}

	async findById(id: string): Promise<InterviewTranscriptionReport | undefined> {
		return await this._connection
			.selectFrom('interview_transcription_report')
			.selectAll()
			.where('id', '=', id)
			.limit(1)
			.executeTakeFirst();
	}

	async insertRaw(data: NewInterviewTranscriptionReport): Promise<InterviewTranscriptionReport> {
		return await this._connection
			.insertInto('interview_transcription_report')
			.values(data)
			.returningAll()
			.executeTakeFirstOrThrow();
	}
}
