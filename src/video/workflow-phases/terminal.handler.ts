import type { PhaseHandler, PhaseHandleResult } from '../ports/phase-handler';

export class TerminalHandler implements PhaseHandler {
	handle(): PhaseHandleResult {
		return { kind: 'terminal' };
	}
}
