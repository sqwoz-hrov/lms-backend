import { Injectable, NotFoundException } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { MaterialRepository } from '../../material.repository';

@Injectable()
export class OpenMaterialForTiersUsecase implements UsecaseInterface {
	constructor(private readonly materialRepository: MaterialRepository) {}

	async execute({ materialId, minimalTierId }: { materialId: string; minimalTierId: string }): Promise<void> {
		const material = await this.materialRepository.findById(materialId);

		if (!material) {
			throw new NotFoundException('Учебный материал не найден');
		}

		await this.materialRepository.setMinimumTier(materialId, minimalTierId);
	}
}
