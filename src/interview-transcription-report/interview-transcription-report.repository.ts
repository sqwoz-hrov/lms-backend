import { Inject, Injectable } from '@nestjs/common';
import { Kysely, sql } from 'kysely';
import { DatabaseProvider } from '../infra/db/db.provider';
import {
	InterviewTranscriptionReportTable,
	LLMReportParsed,
	NewInterviewTranscriptionReport,
} from './interview-transcription-report.entity';

interface ReportDb {
	interview_transcription_report: InterviewTranscriptionReportTable;
}

@Injectable()
export class InterviewTranscriptionReportRepository {
	private readonly connection: Kysely<ReportDb>;

	constructor(@Inject(DatabaseProvider) dbProvider: DatabaseProvider) {
		this.connection = dbProvider.getDatabase<ReportDb>();
	}

	async save(data: NewInterviewTranscriptionReport): Promise<void> {
		await this.connection
			.insertInto('interview_transcription_report')
			.values({
				...data,
				llm_report_parsed: sql<LLMReportParsed>`${JSON.stringify(data.llm_report_parsed)}`,
			})
			.execute();
	}
}
