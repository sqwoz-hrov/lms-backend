import { Generated, Insertable, Selectable, Updateable } from "kysely";

// make frontend at first?
// TODO: migrations
type LLMReportParsed = ({ hintType: 'error'; lineId: number; topic: string; errorType: 'blunder' | 'inaccuracy'; whyBad: string; howToFix: string } |
	{ hintType: 'note'; lineId: number; topic: string; note: string } |
	{ hintType: 'praise'; lineId: number; topic: string; praise: string }
)[];
export interface InterviewTranscriptionReportTable {
	id: Generated<string>;
	interview_transcription_id: string;
	candidate_name_in_transcription: string;
	llm_report_raw: string;
	llm_report_parsed: LLMReportParsed;
}

export type InterviewTranscriptionReport = Selectable<InterviewTranscriptionReportTable>;
export type NewInterviewTranscriptionReport = Insertable<InterviewTranscriptionReportTable>;
export type InterviewTranscriptionReportUpdate = Updateable<InterviewTranscriptionReportTable>;

