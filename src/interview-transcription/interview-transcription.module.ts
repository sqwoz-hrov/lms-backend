import { DynamicModule, Module } from '@nestjs/common';
import { VideoRepository } from '../video/video.repoistory';
import { SseModule } from '../sse/sse.module';
import { TensordockFakeAdapter } from './adapters/tensordock-fake.adapter';
import { TensordockAdapter } from './adapters/tensordock.adapter';
import { InterviewTranscriptionRepository } from './interview-transcription.repository';
import { VM_ORCHESTRATOR_ADAPTER } from './ports/vm-orchestrator.adapter';
import { InterviewTranscriptionService } from './services/interview-transcription.service';
import { InterviewTranscriptionChunkEventsService } from './services/interview-transcription-chunk-events.service';
import { HandleTranscriptionFinishWebhookController } from './usecase/handle-transcription-finish-webhook/handle-transcription-finish-webhook.controller';
import { HandleTranscriptionFinishWebhookUsecase } from './usecase/handle-transcription-finish-webhook/handle-transcription-finish-webhook.usecase';
import { StartInterviewTranscriptionController } from './usecase/start-transcription/start-interview-transcription.controller';
import { StartInterviewTranscriptionUsecase } from './usecase/start-transcription/start-interview-transcription.usecase';
import { ListInterviewTranscriptionsController } from './usecase/list-transcriptions/list-interview-transcriptions.controller';
import { ListInterviewTranscriptionsUsecase } from './usecase/list-transcriptions/list-interview-transcriptions.usecase';
import { GetInterviewTranscriptionController } from './usecase/get-transcription/get-interview-transcription.controller';
import { GetInterviewTranscriptionUsecase } from './usecase/get-transcription/get-interview-transcription.usecase';

@Module({})
export class InterviewTranscriptionModule {
	static forRoot({ useFakeVmOrchestrator }: { useFakeVmOrchestrator: boolean }): DynamicModule {
		return {
			module: InterviewTranscriptionModule,
			imports: [SseModule],
			controllers: [
				StartInterviewTranscriptionController,
				HandleTranscriptionFinishWebhookController,
				ListInterviewTranscriptionsController,
				GetInterviewTranscriptionController,
			],
			providers: [
				InterviewTranscriptionRepository,
				InterviewTranscriptionService,
				InterviewTranscriptionChunkEventsService,
				StartInterviewTranscriptionUsecase,
				HandleTranscriptionFinishWebhookUsecase,
				ListInterviewTranscriptionsUsecase,
				GetInterviewTranscriptionUsecase,
				VideoRepository,
				{
					provide: VM_ORCHESTRATOR_ADAPTER,
					useClass: useFakeVmOrchestrator ? TensordockFakeAdapter : TensordockAdapter,
				},
			],
		};
	}
}
