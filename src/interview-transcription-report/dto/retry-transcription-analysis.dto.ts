import { IsUUID } from 'class-validator';

export class RetryTranscriptionAnalysisParamsDto {
	@IsUUID()
	transcription_id: string;
}
