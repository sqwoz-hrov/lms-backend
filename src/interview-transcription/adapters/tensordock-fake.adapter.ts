import { Injectable } from '@nestjs/common';
import { VmInstanceStatus, VmOrchestratorAdapter, VmPowerState } from '../ports/vm-orchestrator.adapter';

@Injectable()
export class TensordockFakeAdapter implements VmOrchestratorAdapter {
	private powerState: VmPowerState = 'stopped';
	private readonly vmId = 'tensordock-fake-vm';

	startVm(): Promise<void> {
		this.powerState = 'running';
		return Promise.resolve();
	}

	stopVm(): Promise<void> {
		this.powerState = 'stopped';
		return Promise.resolve();
	}

	getVmStatus(): Promise<VmInstanceStatus> {
		return Promise.resolve({
			id: this.vmId,
			powerState: this.powerState,
			status: this.powerState === 'running' ? 'active' : 'inactive',
			publicIpv4: undefined,
			raw: {
				id: this.vmId,
				powerState: this.powerState,
			},
		});
	}
}
