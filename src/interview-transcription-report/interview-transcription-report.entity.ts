import { Insertable, Selectable, Updateable } from 'kysely';
import { Generated } from '../common/kysely-types/generated';

export type LLMReportParsed = (
	| {
			hintType: 'error';
			lineId: number;
			topic: string;
			errorType: 'blunder' | 'inaccuracy';
			whyBad: string;
			howToFix: string;
	  }
	| { hintType: 'note'; lineId: number; topic: string; note: string }
	| { hintType: 'praise'; lineId: number; topic: string; praise: string }
)[];
export interface InterviewTranscriptionReportTable {
	id: Generated<string>; // uuid v7
	interview_transcription_id: string; // foreign key to interview_transcription table
	llm_report_parsed: LLMReportParsed; // jsonb, check constraint to ensure it's an array of objects with the specified structure
	candidate_name_in_transcription: string; // text, SPEAKER_01, SPEAKER_02, etc. - this is used to match the LLM report to the correct speaker in the transcription
	candidate_name: string | undefined; // text, the actual name of the candidate, not just the placeholder in the transcription
}

export type InterviewTranscriptionReport = Selectable<InterviewTranscriptionReportTable>;
export type NewInterviewTranscriptionReport = Insertable<InterviewTranscriptionReportTable>;
export type InterviewTranscriptionReportUpdate = Updateable<InterviewTranscriptionReportTable>;
