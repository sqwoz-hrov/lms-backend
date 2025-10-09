import { Injectable } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { TaskResponseDto } from '../../dto/base-task.dto';
import { CreateTaskForMultipleUsersDto } from '../../dto/create-task-for-multiple-users.dto';
import { User } from '../../../user/user.entity';
import { CreateTaskUsecase } from '../create-task/create-task.usecase';

@Injectable()
export class CreateTaskForMultipleStudentsUsecase implements UsecaseInterface {
	constructor(private readonly createTaskUsecase: CreateTaskUsecase) {}

	async execute({
		user,
		params,
	}: {
		user: User;
		params: CreateTaskForMultipleUsersDto;
	}): Promise<TaskResponseDto[] | undefined> {
		const { student_user_ids, ...taskPayload } = params;

		const createdTasks: TaskResponseDto[] = [];

		for (const studentId of student_user_ids) {
			const task = await this.createTaskUsecase.execute({
				user,
				params: {
					...taskPayload,
					student_user_id: studentId,
				},
			});

			if (!task) {
				return undefined;
			}

			createdTasks.push(task);
		}

		return createdTasks;
	}
}
