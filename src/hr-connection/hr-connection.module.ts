import { Module } from '@nestjs/common';
import { UserModule } from '../user/user.module';
import { HrConnectionRepository } from './hr-connection.repository';
import { CreateHrConnectionController } from './usecases/create-hr-connection/create-hr-connection.controller';
import { CreateHrConnectionUsecase } from './usecases/create-hr-connection/create-hr-connection.usecase';
import { DeleteHrConnectionController } from './usecases/delete-hr-connection/delete-hr-connection.controller';
import { DeleteHrConnectionUsecase } from './usecases/delete-hr-connection/delete-hr-connection.usecase';
import { EditHrConnectionController } from './usecases/edit-hr-connection/edit-hr-connection.controller';
import { EditHrConnectionUsecase } from './usecases/edit-hr-connection/edit-hr-connection.usecase';
import { GetHrConnectionsController } from './usecases/get-hr-connections/get-hr-connections.controller';
import { GetHrConnectionsUsecase } from './usecases/get-hr-connections/get-hr-connections.usecase';

@Module({
	imports: [UserModule],
	controllers: [
		CreateHrConnectionController,
		DeleteHrConnectionController,
		EditHrConnectionController,
		GetHrConnectionsController,
	],
	providers: [
		CreateHrConnectionUsecase,
		DeleteHrConnectionUsecase,
		EditHrConnectionUsecase,
		GetHrConnectionsUsecase,
		HrConnectionRepository,
	],
})
export class HrConnectionModule {}
