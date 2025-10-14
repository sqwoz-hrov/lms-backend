import { UserMeta, ValidateSDK } from '../../../test/test.abstract.sdk';
import { TestHttpClient } from '../../../test/test.http-client';
import { ArchiveMaterialDto } from '../dto/archive-material.dto';
import { MaterialResponseDto } from '../dto/base-material.dto';
import { CreateMaterialDto } from '../dto/create-material.dto';
import { GetMaterialsDto } from '../dto/get-materials.dto';
import { UpdateMaterialDto } from '../dto/update-material.dto';
import { OpenMaterialForTiersDto } from '../dto/open-material-for-tiers.dto';

export class MaterialsTestSdk implements ValidateSDK<MaterialsTestSdk> {
	constructor(private readonly testClient: TestHttpClient) {}

	public async archiveMaterial({ params, userMeta }: { params: ArchiveMaterialDto; userMeta: UserMeta }) {
		return this.testClient.request<MaterialResponseDto>({
			path: '/materials/archive',
			method: 'PUT',
			body: params,
			userMeta,
		});
	}

	public async createMaterial({ params, userMeta }: { params: CreateMaterialDto; userMeta: UserMeta }) {
		return this.testClient.request<MaterialResponseDto>({
			path: '/materials',
			method: 'POST',
			userMeta,
			body: params,
		});
	}

	public async editMaterial({ params, userMeta }: { params: UpdateMaterialDto; userMeta: UserMeta }) {
		return this.testClient.request<MaterialResponseDto>({
			path: '/materials',
			method: 'PUT',
			userMeta,
			body: params,
		});
	}

	public async getMaterials({ params, userMeta }: { params: GetMaterialsDto; userMeta: UserMeta }) {
		const queryParams = new URLSearchParams();

		for (const [key, value] of Object.entries(params)) {
			queryParams.append(key, value);
		}

		return this.testClient.request<MaterialResponseDto[]>({
			path: `/materials?${queryParams.toString()}`,
			method: 'GET',
			userMeta,
		});
	}

	public async openMaterialForTiers({
		materialId,
		params,
		userMeta,
	}: {
		materialId: string;
		params: OpenMaterialForTiersDto;
		userMeta: UserMeta;
	}) {
		return this.testClient.request<void>({
			path: `/materials/${materialId}/open-for-tiers`,
			method: 'POST',
			body: params,
			userMeta,
		});
	}
}
