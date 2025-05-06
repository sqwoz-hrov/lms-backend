import { Module } from '@nestjs/common';
import { UserModule } from '../user/user.module';
import { CreateMaterialController } from './usecases/create-material/create-material.controller';
import { CreateMaterialUsecase } from './usecases/create-material/create-material.usecase';
import { MaterialRepository } from './material.repository';
import { ArchiveMaterialController } from './usecases/archive-material/archive-material.controller';
import { EditMaterialController } from './usecases/edit-material/edit-material.controller';
import { GetMaterialsController } from './usecases/get-materials/get-materials.controller';
import { ArchiveMaterialUsecase } from './usecases/archive-material/archive-material.usecase';
import { EditMaterialUsecase } from './usecases/edit-material/edit-material.usecase';
import { GetMaterialsUsecase } from './usecases/get-materials/get-materials.usecase';

@Module({
	imports: [UserModule],
	controllers: [ArchiveMaterialController, CreateMaterialController, EditMaterialController, GetMaterialsController],
	providers: [
		ArchiveMaterialUsecase,
		CreateMaterialUsecase,
		EditMaterialUsecase,
		GetMaterialsUsecase,
		MaterialRepository,
	],
})
export class MaterialModule {}
