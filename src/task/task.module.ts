import { Module } from '@nestjs/common';
import { UserModule } from '../user/user.module';
import { TaskRepository } from './task.repository';
import { ChangeTaskStatusController } from './usecases/change-task-status/change-task-status.controller';
import { ChangeTaskStatusUsecase } from './usecases/change-task-status/change-task-status.usecase';
import { CreateTaskController } from './usecases/create-task/create-task.controller';
import { CreateTaskUsecase } from './usecases/create-task/create-task.usecase';
import { DeleteTaskController } from './usecases/delete-task/delete-task.controller';
import { DeleteTaskUsecase } from './usecases/delete-task/delete-task.usecase';
import { EditTaskController } from './usecases/edit-task/edit-task.controller';
import { EditTaskUsecase } from './usecases/edit-task/edit-task.usecase';
import { GetTaskInfoController } from './usecases/get-task-info/get-task-info.controller';
import { GetTaskInfoUsecase } from './usecases/get-task-info/get-task-info.usecase';
import { GetTasksController } from './usecases/get-tasks/get-tasks.controller';
import { GetTasksUsecase } from './usecases/get-tasks/get-tasks.usecase';
import { CreateTaskForMultipleStudentsController } from './usecases/create-for-multiple-students/create-for-multiple-students.controller';
import { CreateTaskForMultipleStudentsUsecase } from './usecases/create-for-multiple-students/create-for-multiple-students.usecase';

@Module({
	imports: [UserModule],
	controllers: [
		ChangeTaskStatusController,
		CreateTaskForMultipleStudentsController,
		CreateTaskController,
		DeleteTaskController,
		EditTaskController,
		GetTaskInfoController,
		GetTasksController,
	],
	providers: [
		ChangeTaskStatusUsecase,
		CreateTaskForMultipleStudentsUsecase,
		CreateTaskUsecase,
		DeleteTaskUsecase,
		EditTaskUsecase,
		GetTaskInfoUsecase,
		GetTasksUsecase,
		TaskRepository,
	],
})
export class TaskModule {}
