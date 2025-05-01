import { Module } from '@nestjs/common';
import { UserModule } from '../users/user.module';
import { TaskRepository } from './task.repository';
import { CreateTaskController } from './usecases/create-task/create-task.controller';
import { CreateTaskUsecase } from './usecases/create-task/create-task.usecase';
import { DeleteTaskController } from './usecases/delete-task/delete-task.controller';
import { DeleteTaskUsecase } from './usecases/delete-task/delete-task.usecase';
import { EditTaskController } from './usecases/edit-task/edit-task.controller';
import { EditTaskUsecase } from './usecases/edit-task/edit-task.usecase';
import { GetTaskInfoController } from './usecases/get-task-info/get-task-info.controller';
import { GetTaskInfoUsecase } from './usecases/get-task-info/get-task-info.usecase';

@Module({
	imports: [UserModule],
	controllers: [CreateTaskController, DeleteTaskController, EditTaskController, GetTaskInfoController],
	providers: [CreateTaskUsecase, DeleteTaskUsecase, EditTaskUsecase, GetTaskInfoUsecase, TaskRepository],
})
export class TaskModule {}
