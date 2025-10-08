import type { Phase, PhaseHandler } from './phase-handler';

export interface PhaseRegistry {
	getHandler(phase: Phase): PhaseHandler;
}
