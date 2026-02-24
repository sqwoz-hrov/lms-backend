import { IsUUID } from 'class-validator';

export class GetTranscriptionReportParams {
	@IsUUID()
	transcription_id: string;
}
