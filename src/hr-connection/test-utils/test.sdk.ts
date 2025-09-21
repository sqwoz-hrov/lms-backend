import { UserMeta, ValidateSDK } from '../../../test/test.abstract.sdk';
import { TestHttpClient } from '../../../test/test.http-client';
import { BaseHrConnectionDto } from '../dto/base-hr-connection.dto';
import { CreateHrConnectionDto } from '../dto/create-hr-connection.dto';
import { DeleteHrConnectionDto } from '../dto/delete-hr-connection.dto';
import { GetHrConnectionsDto } from '../dto/get-hr-connections.dto';
import { UpdateHrConnectionDto } from '../dto/update-hr-connection.dto';

export class HrConnectionsTestSdk implements ValidateSDK<HrConnectionsTestSdk> {
	constructor(private readonly testClient: TestHttpClient) {}

	public async createHrConnection({ params, userMeta }: { params: CreateHrConnectionDto; userMeta: UserMeta }) {
		return this.testClient.request<BaseHrConnectionDto>({
			path: '/hr-connections',
			method: 'POST',
			body: params,
			userMeta,
		});
	}

	public async editHrConnection({ params, userMeta }: { params: UpdateHrConnectionDto; userMeta: UserMeta }) {
		return this.testClient.request<BaseHrConnectionDto>({
			path: '/hr-connections',
			method: 'PUT',
			body: params,
			userMeta,
		});
	}

	public async deleteHrConnection({ params, userMeta }: { params: DeleteHrConnectionDto; userMeta: UserMeta }) {
		return this.testClient.request<BaseHrConnectionDto>({
			path: '/hr-connections',
			method: 'DELETE',
			body: params,
			userMeta,
		});
	}

	public async getHrConnections({ params, userMeta }: { params: GetHrConnectionsDto; userMeta: UserMeta }) {
		const queryParams = new URLSearchParams();

		for (const [key, value] of Object.entries(params)) {
			queryParams.append(key, value);
		}

		return this.testClient.request<BaseHrConnectionDto[]>({
			path: `/hr-connections?${queryParams.toString()}`,
			method: 'GET',
			userMeta,
		});
	}
}
