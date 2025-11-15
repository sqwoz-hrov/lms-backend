import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { tensordockConfig } from '../../config';
import { VmInstanceStatus, VmOrchestratorAdapter } from '../ports/vm-orchestrator.adapter';

export type TensordockInstanceResponse = {
	type: 'virtualmachine';
	id: string;
	name: string;
	status: 'running' | 'stoppeddisassociated';
	portForwards: [];
	ipAddress: string;
	resources: {
		vcpu_count: number;
		ram_gb: number;
		storage_gb: number;
		gpus: Record<string, any>;
	};
	rateHourly: number;
};

@Injectable()
export class TensordockAdapter implements VmOrchestratorAdapter {
	private readonly logger = new Logger(TensordockAdapter.name);
	private readonly baseUrl: string;
	private readonly authHeader: string;

	constructor(
		@Inject(tensordockConfig.KEY)
		private readonly config: ConfigType<typeof tensordockConfig>,
	) {
		this.baseUrl = this.config.apiUrl.replace(/\/$/, '');
		this.authHeader = `Bearer ${this.config.token}`;
	}

	async startVm(): Promise<void> {
		try {
			await this.request(`instances/${this.config.vmId}/start`, { method: 'POST' });
			this.logger.log(`TensorDock VM ${this.config.vmId} start requested`);
		} catch (error) {
			this.handleRequestError('start', error);
		}
	}

	async stopVm(): Promise<void> {
		try {
			await this.request(`instances/${this.config.vmId}/stop`, { method: 'POST' });
			this.logger.log(`TensorDock VM ${this.config.vmId} stop requested`);
		} catch (error) {
			this.handleRequestError('stop', error);
		}
	}

	async getVmStatus(): Promise<VmInstanceStatus> {
		try {
			const body = await this.requestJson<TensordockInstanceResponse>(`instances/${this.config.vmId}`);

			return {
				id: body.id,
				name: body.name,
				status: body.status,
				publicIpv4: body.ipAddress,
				powerState: body.status === 'running' ? body.status : 'stopped',
				raw: body,
			};
		} catch (error) {
			this.handleRequestError('status', error);
		}
	}

	private async request(path: string, init?: RequestInit): Promise<Response> {
		const url = new URL(path, `${this.baseUrl}/`).toString();
		const response = await fetch(url, {
			...init,
			headers: this.mergeHeaders(init?.headers),
		});

		if (!response.ok) {
			const errorBody = await this.safeReadBody(response);
			throw new Error(
				`TensorDock request failed (${response.status} ${response.statusText}) for ${path}: ${errorBody}`,
			);
		}

		return response;
	}

	private async requestJson<T>(path: string, init?: RequestInit): Promise<T> {
		const response = await this.request(path, init);
		return (await response.json()) as T;
	}

	private mergeHeaders(headers?: HeadersInit): Headers {
		const merged = new Headers(headers ?? {});
		merged.set('Authorization', this.authHeader);
		return merged;
	}

	private async safeReadBody(response: Response): Promise<string> {
		try {
			return await response.text();
		} catch {
			return '<unreadable response>';
		}
	}

	private handleRequestError(action: string, error: unknown): never {
		const err = error instanceof Error ? error : new Error(String(error));
		this.logger.error(`TensorDock VM ${action} request failed: ${err.message}`, err.stack);
		throw err;
	}
}
