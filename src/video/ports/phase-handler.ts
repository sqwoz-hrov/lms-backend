import type { Video } from '../video.entity';
import type { UploadPhase } from '../video.entity';

export type PhaseHandleResult = { kind: 'no-op' } | { kind: 'advance'; nextPhase: UploadPhase } | { kind: 'terminal' };

export interface PhaseHandler {
	handle(video: Video): Promise<PhaseHandleResult> | PhaseHandleResult;
}

export type Phase = UploadPhase | 'receiving-gate';
