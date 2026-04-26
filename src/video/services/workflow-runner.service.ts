import { Inject, Injectable, Logger } from '@nestjs/common';
import type { UploadPhase, Video } from '../video.entity';
import { VideoRepository } from '../video.repoistory';
import { Phase, PhaseHandler } from '../ports/phase-handler';
import { ReceivingGateHandler } from '../workflow-phases/recieving-gate.handler';
import { ConvertingHandler } from '../workflow-phases/converting.handler';
import { HashingHandler } from '../workflow-phases/hashing.handler';
import { UploadingS3Handler } from '../workflow-phases/upload.handler';
import { TerminalHandler } from '../workflow-phases/terminal.handler';
import { VideoStorageService } from './video-storage.service';
import { VideoTranscoderService } from './video-transcoder.service';
import { SseService } from '../../sse/sse.service';
import { VideoUploadWorkflowPolicyService } from './video-upload-workflow-policy.service';
import type { PhaseCompensateContext } from '../ports/phase-handler';

export type AdvanceResult = {
	videoId: string;
	fromPhase: UploadPhase;
	toPhase: UploadPhase;
	didWork: boolean;
	terminal?: boolean;
};

@Injectable()
export class WorkflowRunnerService {
	private readonly logger = new Logger(WorkflowRunnerService.name);
	private readonly handlers: Record<Phase, PhaseHandler>;

	constructor(
		private readonly videoRepo: VideoRepository,
		private readonly storage: VideoStorageService,
		private readonly transcoder: VideoTranscoderService,
		private readonly workflowPolicy: VideoUploadWorkflowPolicyService,
		@Inject(SseService)
		private readonly sseService: SseService,
	) {
		const terminal = new TerminalHandler();
		const receivingGate = new ReceivingGateHandler();
		this.handlers = {
			receiving: receivingGate,
			'receiving-gate': receivingGate,
			converting: new ConvertingHandler(this.videoRepo, this.transcoder),
			hashing: new HashingHandler(this.videoRepo),
			uploading_s3: new UploadingS3Handler(this.videoRepo, this.storage, this.transcoder),
			completed: terminal,
			failed: terminal,
		};
	}

	async advance(videoId: string): Promise<AdvanceResult> {
		this.logger.log(`Advance requested for video ${videoId}`);
		let current = await this.videoRepo.findById(videoId);
		if (!current) throw new Error(`Video not found: ${videoId}`);

		const fromPhase = current.phase;
		this.logger.log(`Advancing workflow for video ${videoId} (phase=${fromPhase})`);
		const next = await this.runOneStep(current);
		this.logger.debug(
			`Step result for video ${videoId}: toPhase=${next.toPhase} didWork=${next.didWork} terminal=${next.terminal}`,
		);

		if (next.terminal) {
			this.logger.log(`Workflow complete for video ${videoId} (terminal phase=${next.toPhase})`);
			return { videoId, fromPhase, toPhase: next.toPhase, didWork: next.didWork, terminal: next.terminal };
		}

		let acc = next;
		while (!acc.terminal && acc.didWork) {
			current = await this.videoRepo.findById(videoId);
			if (!current) break;
			this.logger.debug(`Continuing workflow for video ${videoId} (phase=${current.phase})`);
			acc = await this.runOneStep(current);
			this.logger.debug(
				`Step result for video ${videoId}: toPhase=${acc.toPhase} didWork=${acc.didWork} terminal=${acc.terminal}`,
			);
		}

		this.logger.log(
			`Workflow advance complete for video ${videoId}: fromPhase=${fromPhase} toPhase=${acc.toPhase} terminal=${acc.terminal}`,
		);
		return { videoId, fromPhase, toPhase: acc.toPhase, didWork: acc.didWork, terminal: acc.terminal };
	}

	private async runOneStep(video: Video): Promise<{ toPhase: UploadPhase; didWork: boolean; terminal: boolean }> {
		const logicalPhase: Phase = video.phase === 'receiving' ? 'receiving-gate' : video.phase;

		const handler = this.getHandler(logicalPhase);

		try {
			this.logger.debug(`Executing handler for video ${video.id} (logicalPhase=${logicalPhase})`);
			const res = await handler.handle(video);

			if (res.kind === 'terminal') {
				this.logger.log(`Video ${video.id} reached terminal state via ${logicalPhase}`);
				return { toPhase: video.phase, didWork: false, terminal: true };
			}

			if (res.kind === 'no-op') {
				this.logger.debug(`Handler reported no-op for video ${video.id} (logicalPhase=${logicalPhase})`);
				return { toPhase: video.phase, didWork: false, terminal: false };
			}

			const updated = await this.videoRepo.setPhase(video.id, res.nextPhase, {
				clearWorkflowFailureState: true,
				clearTerminalFailureState: true,
			});
			this.logger.log(
				`Advanced video ${video.id} from phase=${video.phase} to phase=${updated.phase} via ${logicalPhase}`,
			);
			if (updated.phase !== video.phase) {
				this.emitVideoPhaseChanged(updated);
			}
			return {
				toPhase: updated.phase,
				didWork: true,
				terminal: updated.phase === 'completed' || updated.phase === 'failed',
			};
		} catch (e) {
			const error = this.ensureError(e);
			const persistedPhase = this.toPersistedPhase(logicalPhase);
			const failureState = await this.videoRepo.recordWorkflowFailure(video.id, persistedPhase, error.message);
			const retryLimit = this.workflowPolicy.retryLimitForPhase(logicalPhase);
			const exhausted = failureState.workflow_retry_count > retryLimit;

			const compensateContext: PhaseCompensateContext = {
				phase: logicalPhase,
				retryCount: failureState.workflow_retry_count,
				retryLimit,
				exhausted,
			};
			await this.runCompensation(handler, video, error, compensateContext);

			this.logger.error(
				`Phase handler failed for video ${video.id} (phase=${video.phase}) retry=${failureState.workflow_retry_count}/${retryLimit}: ${error.message}`,
				error,
			);

			if (exhausted) {
				const failed = await this.videoRepo.markUploadFailedTerminal(video.id, persistedPhase, error.message);
				if (failed.phase !== video.phase) {
					this.emitVideoPhaseChanged(failed);
				}
				return { toPhase: failed.phase, didWork: true, terminal: true };
			}

			const retryIndex = failureState.workflow_retry_count;
			const backoffMs = this.workflowPolicy.computeBackoffMs(retryIndex);
			if (backoffMs > 0) {
				this.logger.warn(
					`Scheduling retry for video ${video.id} phase=${video.phase} in ${backoffMs}ms (retryIndex=${retryIndex})`,
				);
				await this.sleep(backoffMs);
			}
			return { toPhase: video.phase, didWork: true, terminal: false };
		}
	}

	private getHandler(phase: Phase): PhaseHandler {
		const handler = this.handlers[phase];
		if (!handler) {
			throw new Error(`No handler registered for phase: ${phase}`);
		}
		return handler;
	}

	private emitVideoPhaseChanged(video: Video): void {
		this.sseService.sendEvent(video.user_id, 'video_upload_phase_changed', {
			videoId: video.id,
			phase: video.phase,
		});
	}

	private toPersistedPhase(phase: Phase): UploadPhase {
		if (phase === 'receiving-gate') {
			return 'receiving';
		}
		return phase;
	}

	private ensureError(error: unknown): Error {
		if (error instanceof Error) {
			return error;
		}
		return new Error(String(error));
	}

	private async runCompensation(
		handler: PhaseHandler,
		video: Video,
		error: Error,
		context: PhaseCompensateContext,
	): Promise<void> {
		if (!handler.compensate) {
			return;
		}

		try {
			await handler.compensate(video, error, context);
		} catch (compensateError) {
			this.logger.error(
				`Compensation failed for video ${video.id} (phase=${context.phase}): ${this.ensureError(compensateError).message}`,
				this.ensureError(compensateError),
			);
		}
	}

	private async sleep(ms: number): Promise<void> {
		await new Promise(resolve => setTimeout(resolve, ms));
	}
}
