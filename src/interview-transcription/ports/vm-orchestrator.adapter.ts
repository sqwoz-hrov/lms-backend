export type VmPowerState = 'running' | 'stopped';

export interface VmInstanceStatus {
	id: string;
	name?: string;
	powerState: VmPowerState;
	status?: string;
	publicIpv4?: string;
	raw: unknown;
}

export interface VmOrchestratorAdapter {
	startVm(): Promise<void>;
	stopVm(): Promise<void>;
	getVmStatus(): Promise<VmInstanceStatus>;
}

export const VM_ORCHESTRATOR_ADAPTER = Symbol('VM_ORCHESTRATOR_ADAPTER');
