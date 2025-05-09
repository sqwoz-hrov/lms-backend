import { UserMeta, ValidateSDK } from '../../../test/test.abstract.sdk';
import { TestHttpClient } from '../../../test/test.http-client';
import { UserFactory } from '../../../test/test.user.factory';
import { ConfigType } from '@nestjs/config';
import { jwtConfig } from '../../config';
import { MaterialResponseDto } from '../dto/base-material.dto';
import { ArchiveMaterialDto } from '../dto/archive-material.dto';
import { CreateMaterialDto } from '../dto/create-material.dto';
import { UpdateMaterialDto } from '../dto/update-material.dto';
import { GetMaterialsDto } from '../dto/get-materials.dto';

export class MaterialsTestSdk implements ValidateSDK<MaterialsTestSdk> {
	private readonly jwtFactory: UserFactory;

	constructor(
		private readonly testClient: TestHttpClient,
		jwtOptions: ConfigType<typeof jwtConfig>,
	) {
		this.jwtFactory = new UserFactory(jwtOptions);
	}

	public async archiveMaterial({ params, userMeta }: { params: ArchiveMaterialDto; userMeta: UserMeta }) {
		const user = this.jwtFactory.getToken(userMeta.userId);
		const jwt = userMeta.isAuth ? user.token : undefined;

		return this.testClient.request<MaterialResponseDto>({
			path: '/materials/archive',
			method: 'PUT',
			body: params,
			jwt,
			wrongJwt: userMeta.isWrongJwt,
		});
	}

	public async createMaterial({ params, userMeta }: { params: CreateMaterialDto; userMeta: UserMeta }) {
		const user = this.jwtFactory.getToken(userMeta.userId);
		const jwt = userMeta.isAuth ? user.token : undefined;

		return this.testClient.request<MaterialResponseDto>({
			path: '/materials',
			method: 'POST',
			jwt,
			wrongJwt: userMeta.isWrongJwt,
			body: params,
		});
	}

	public async editMaterial({ params, userMeta }: { params: UpdateMaterialDto; userMeta: UserMeta }) {
		const user = this.jwtFactory.getToken(userMeta.userId);
		const jwt = userMeta.isAuth ? user.token : undefined;

		return this.testClient.request<MaterialResponseDto>({
			path: '/materials',
			method: 'PUT',
			jwt,
			wrongJwt: userMeta.isWrongJwt,
			body: params,
		});
	}

	public async getMaterials({ params, userMeta }: { params: GetMaterialsDto; userMeta: UserMeta }) {
		const user = this.jwtFactory.getToken(userMeta.userId);
		const jwt = userMeta.isAuth ? user.token : undefined;

		const queryParams = new URLSearchParams();

		for (const [key, value] of Object.entries(params)) {
			queryParams.append(key, value);
		}

		return this.testClient.request<MaterialResponseDto[]>({
			path: `/materials?${queryParams.toString()}`,
			method: 'GET',
			jwt,
			wrongJwt: userMeta.isWrongJwt,
		});
	}
}
