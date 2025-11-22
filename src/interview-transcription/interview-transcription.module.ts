import { DynamicModule, Module } from '@nestjs/common';
import { VideoRepository } from '../video/video.repoistory';
import { TensordockFakeAdapter } from './adapters/tensordock-fake.adapter';
import { TensordockAdapter } from './adapters/tensordock.adapter';
import { InterviewTranscriptionRepository } from './interview-transcription.repository';
import { VM_ORCHESTRATOR_ADAPTER } from './ports/vm-orchestrator.adapter';
import { InterviewTranscriptionService } from './services/interview-transcription.service';
import { HandleTranscriptionFinishWebhookController } from './usecase/handle-transcription-finish-webhook/handle-transcription-finish-webhook.controller';
import { HandleTranscriptionFinishWebhookUsecase } from './usecase/handle-transcription-finish-webhook/handle-transcription-finish-webhook.usecase';
import { StartInterviewTranscriptionController } from './usecase/start-transcription/start-interview-transcription.controller';
import { StartInterviewTranscriptionUsecase } from './usecase/start-transcription/start-interview-transcription.usecase';

@Module({})
export class InterviewTranscriptionModule {
	static forRoot({ useFakeVmOrchestrator }: { useFakeVmOrchestrator: boolean }): DynamicModule {
		return {
			module: InterviewTranscriptionModule,
			controllers: [StartInterviewTranscriptionController, HandleTranscriptionFinishWebhookController],
			providers: [
				InterviewTranscriptionRepository,
				InterviewTranscriptionService,
				StartInterviewTranscriptionUsecase,
				HandleTranscriptionFinishWebhookUsecase,
				VideoRepository,
				{
					provide: VM_ORCHESTRATOR_ADAPTER,
					useClass: useFakeVmOrchestrator ? TensordockFakeAdapter : TensordockAdapter,
				},
			],
		};
	}
}
