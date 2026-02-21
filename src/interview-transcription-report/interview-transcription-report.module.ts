import { Module } from '@nestjs/common';
import { InterviewTranscriptionReportController } from './usecase/receive-transcription-report-webhook/receive-transcription-report-webhook.controller';
import { ReceiveTranscriptionReportWebhookUsecase } from './usecase/receive-transcription-report-webhook/receive-transcription-report-webhook.usecase';
import { InterviewTranscriptionReportRepository } from './interview-transcription-report.repository';

@Module({
	controllers: [InterviewTranscriptionReportController],
	providers: [ReceiveTranscriptionReportWebhookUsecase, InterviewTranscriptionReportRepository],
})
export class InterviewTranscriptionReportModule {}
