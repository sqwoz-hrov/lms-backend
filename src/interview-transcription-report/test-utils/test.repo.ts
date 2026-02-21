import { Kysely, sql } from 'kysely';
import { DatabaseProvider } from '../../infra/db/db.provider';
import {
	InterviewTranscriptionReport,
	InterviewTranscriptionReportTable,
	LLMReportParsed,
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

	async findAll(): Promise<InterviewTranscriptionReport[]> {
		return await this._connection.selectFrom('interview_transcription_report').selectAll().execute();
	}

	async insertRaw(data: NewInterviewTranscriptionReport): Promise<InterviewTranscriptionReport> {
		const llmReportParsed =
			typeof data.llm_report_parsed === 'string' ? data.llm_report_parsed : JSON.stringify(data.llm_report_parsed);

		return await this._connection
			.insertInto('interview_transcription_report')
			.values({
				...data,
				llm_report_parsed: sql<LLMReportParsed>`${llmReportParsed}`,
			})
			.returningAll()
			.executeTakeFirstOrThrow();
	}
}
