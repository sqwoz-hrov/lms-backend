import { Module } from '@nestjs/common';
import { InterviewTranscriptionRepository } from '../interview-transcription/interview-transcription.repository';
import { InterviewTranscriptionReportRepository } from './interview-transcription-report.repository';
import { GetTranscriptionReportController } from './usecase/get-transcription-report/get-transcription-report.controller';
import { GetTranscriptionReportUsecase } from './usecase/get-transcription-report/get-transcription-report.usecase';
import { InterviewTranscriptionReportController } from './usecase/receive-transcription-report-webhook/receive-transcription-report-webhook.controller';
import { ReceiveTranscriptionReportWebhookUsecase } from './usecase/receive-transcription-report-webhook/receive-transcription-report-webhook.usecase';
@Module({
	controllers: [InterviewTranscriptionReportController, GetTranscriptionReportController],
	providers: [
		ReceiveTranscriptionReportWebhookUsecase,
		InterviewTranscriptionReportRepository,
		GetTranscriptionReportUsecase,
		InterviewTranscriptionRepository,
	],
})
export class InterviewTranscriptionReportModule {}
