import type { PhaseHandler, PhaseHandleResult } from '../ports/phase-handler';
import type { Video } from '../video.entity';
import { calcOffsetFromRanges } from '../utils/calc-offset-from-ranges';
import * as fs from 'fs';

export class ReceivingGateHandler implements PhaseHandler {
	handle(video: Video): PhaseHandleResult {
		const total = Number(video.total_size);
		const offset = calcOffsetFromRanges(video.uploaded_ranges);

		if (offset < total) {
			return { kind: 'no-op' };
		}

		if (!video.tmp_path || !fs.existsSync(video.tmp_path)) {
			throw new Error(`Tmp file missing for video ${video.id} at receiving-gate`);
		}

		return { kind: 'advance', nextPhase: 'converting' };
	}
}
