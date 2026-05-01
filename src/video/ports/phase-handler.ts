import type { Video } from '../video.entity';
import type { UploadPhase } from '../video.entity';

export type PhaseHandleResult = { kind: 'no-op' } | { kind: 'advance'; nextPhase: UploadPhase } | { kind: 'terminal' };

export type PhaseCompensateContext = {
	phase: Phase;
	retryCount: number;
	retryLimit: number;
	exhausted: boolean;
};

export interface PhaseHandler {
	handle(video: Video): Promise<PhaseHandleResult> | PhaseHandleResult;
	compensate?(video: Video, error: Error, context: PhaseCompensateContext): Promise<void> | void;
}

export type Phase = UploadPhase | 'receiving-gate';
