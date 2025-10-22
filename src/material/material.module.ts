import { Module } from '@nestjs/common';
import { CreateMaterialController } from './usecases/create-material/create-material.controller';
import { CreateMaterialUsecase } from './usecases/create-material/create-material.usecase';
import { MaterialRepository } from './material.repository';
import { ArchiveMaterialController } from './usecases/archive-material/archive-material.controller';
import { EditMaterialController } from './usecases/edit-material/edit-material.controller';
import { GetMaterialsController } from './usecases/get-materials/get-materials.controller';
import { OpenMaterialForTiersController } from './usecases/open-for-tiers/open-for-tiers.controller';
import { ArchiveMaterialUsecase } from './usecases/archive-material/archive-material.usecase';
import { EditMaterialUsecase } from './usecases/edit-material/edit-material.usecase';
import { GetMaterialsUsecase } from './usecases/get-materials/get-materials.usecase';
import { OpenMaterialForTiersUsecase } from './usecases/open-for-tiers/open-for-tiers.usecase';

@Module({
	controllers: [
		ArchiveMaterialController,
		CreateMaterialController,
		EditMaterialController,
		GetMaterialsController,
		OpenMaterialForTiersController,
	],
	providers: [
		ArchiveMaterialUsecase,
		CreateMaterialUsecase,
		EditMaterialUsecase,
		GetMaterialsUsecase,
		OpenMaterialForTiersUsecase,
		MaterialRepository,
	],
})
export class MaterialModule {}
