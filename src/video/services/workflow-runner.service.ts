import { Injectable, Logger } from '@nestjs/common';
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
	) {
		const terminal = new TerminalHandler();
		const receivingGate = new ReceivingGateHandler();
		this.handlers = {
			receiving: receivingGate,
			'receiving-gate': receivingGate,
			converting: new ConvertingHandler(this.videoRepo, this.transcoder),
			hashing: new HashingHandler(this.videoRepo),
			uploading_s3: new UploadingS3Handler(this.videoRepo, this.storage),
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

			const updated = await this.videoRepo.setPhase(video.id, res.nextPhase);
			this.logger.log(
				`Advanced video ${video.id} from phase=${video.phase} to phase=${updated.phase} via ${logicalPhase}`,
			);
			return {
				toPhase: updated.phase,
				didWork: true,
				terminal: updated.phase === 'completed' || updated.phase === 'failed',
			};
		} catch (e) {
			this.logger.error(
				`Phase handler failed for video ${video.id} (phase=${video.phase}): ${(e as Error).message}`,
				e as Error,
			);
			const failed = await this.videoRepo.setPhase(video.id, 'failed');
			return { toPhase: failed.phase, didWork: true, terminal: true };
		}
	}

	private getHandler(phase: Phase): PhaseHandler {
		const handler = this.handlers[phase];
		if (!handler) {
			throw new Error(`No handler registered for phase: ${phase}`);
		}
		return handler;
	}
}
