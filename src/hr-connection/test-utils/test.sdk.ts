import { ConfigType } from '@nestjs/config';
import { UserMeta, ValidateSDK } from '../../../test/test.abstract.sdk';
import { TestHttpClient } from '../../../test/test.http-client';
import { UserFactory } from '../../../test/test.user.factory';
import { jwtConfig } from '../../config';
import { BaseHrConnectionDto } from '../dto/base-hr-connection.dto';
import { CreateHrConnectionDto } from '../dto/create-hr-connection.dto';
import { UpdateHrConnectionDto } from '../dto/update-hr-connection.dto';
import { DeleteHrConnectionDto } from '../dto/delete-hr-connection.dto';
import { GetHrConnectionsDto } from '../dto/get-hr-connections.dto';

export class HrConnectionsTestSdk implements ValidateSDK<HrConnectionsTestSdk> {
	private readonly jwtFactory: UserFactory;

	constructor(
		private readonly testClient: TestHttpClient,
		jwtOptions: ConfigType<typeof jwtConfig>,
	) {
		this.jwtFactory = new UserFactory(jwtOptions);
	}

	public async createHrConnection({ params, userMeta }: { params: CreateHrConnectionDto; userMeta: UserMeta }) {
		const user = this.jwtFactory.getToken(userMeta.userId);
		const jwt = userMeta.isAuth ? user.token : undefined;

		return this.testClient.request<BaseHrConnectionDto>({
			path: '/hr-connections',
			method: 'POST',
			body: params,
			jwt,
			wrongJwt: userMeta.isWrongJwt,
		});
	}

	public async editHrConnection({ params, userMeta }: { params: UpdateHrConnectionDto; userMeta: UserMeta }) {
		const user = this.jwtFactory.getToken(userMeta.userId);
		const jwt = userMeta.isAuth ? user.token : undefined;

		return this.testClient.request<BaseHrConnectionDto>({
			path: '/hr-connections',
			method: 'PUT',
			body: params,
			jwt,
			wrongJwt: userMeta.isWrongJwt,
		});
	}

	public async deleteHrConnection({ params, userMeta }: { params: DeleteHrConnectionDto; userMeta: UserMeta }) {
		const user = this.jwtFactory.getToken(userMeta.userId);
		const jwt = userMeta.isAuth ? user.token : undefined;

		return this.testClient.request<BaseHrConnectionDto>({
			path: '/hr-connections',
			method: 'DELETE',
			body: params,
			jwt,
			wrongJwt: userMeta.isWrongJwt,
		});
	}

	public async getHrConnections({ params, userMeta }: { params: GetHrConnectionsDto; userMeta: UserMeta }) {
		const user = this.jwtFactory.getToken(userMeta.userId);
		const jwt = userMeta.isAuth ? user.token : undefined;

		const queryParams = new URLSearchParams();

		for (const [key, value] of Object.entries(params)) {
			queryParams.append(key, value);
		}

		return this.testClient.request<BaseHrConnectionDto[]>({
			path: `/hr-connections?${queryParams.toString()}`,
			method: 'GET',
			jwt,
			wrongJwt: userMeta.isWrongJwt,
		});
	}
}
