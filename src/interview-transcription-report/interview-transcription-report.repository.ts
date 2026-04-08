import { Inject, Injectable } from '@nestjs/common';
import { Kysely, sql } from 'kysely';
import { DatabaseProvider } from '../infra/db/db.provider';
import {
	InterviewTranscriptionReport,
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
		// PG driver turns top-level JS arrays into array literals, so stringify to feed the jsonb column valid JSON
		const llmReportParsed =
			typeof data.llm_report_parsed === 'string' ? data.llm_report_parsed : JSON.stringify(data.llm_report_parsed);

		await this.connection
			.insertInto('interview_transcription_report')
			.values({
				...data,
				llm_report_parsed: sql<LLMReportParsed>`${llmReportParsed}`,
			})
			.execute();
	}

	async saveOrReplaceByTranscriptionId(data: NewInterviewTranscriptionReport): Promise<void> {
		const llmReportParsed =
			typeof data.llm_report_parsed === 'string' ? data.llm_report_parsed : JSON.stringify(data.llm_report_parsed);

		const updated = await this.connection
			.updateTable('interview_transcription_report')
			.set({
				llm_report_parsed: sql<LLMReportParsed>`${llmReportParsed}`,
				candidate_name_in_transcription: data.candidate_name_in_transcription,
				candidate_name: data.candidate_name ?? null,
			})
			.where('interview_transcription_id', '=', data.interview_transcription_id)
			.returningAll()
			.executeTakeFirst();

		if (updated) {
			return;
		}

		await this.connection
			.insertInto('interview_transcription_report')
			.values({
				...data,
				llm_report_parsed: sql<LLMReportParsed>`${llmReportParsed}`,
			})
			.execute();
	}

	async findByTranscriptionId(transcriptionId: string): Promise<InterviewTranscriptionReport | undefined> {
		return await this.connection
			.selectFrom('interview_transcription_report')
			.selectAll()
			.where('interview_transcription_id', '=', transcriptionId)
			.limit(1)
			.executeTakeFirst();
	}
}
