import { Injectable } from '@nestjs/common';
import { TaskRepository } from '../../task.repository';
import { TaskResponseDto } from '../../dto/base-task.dto';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { GetTasksDto } from '../../dto/get-tasks.dto';
import { User } from '../../../user/user.entity';

@Injectable()
export class GetTasksUsecase implements UsecaseInterface {
	constructor(private readonly taskRepository: TaskRepository) {}

	async execute({ user, params }: { user: User; params: GetTasksDto }): Promise<TaskResponseDto[]> {
		if (user.role === 'user') {
			params.student_user_id = user.id;
		}

		return await this.taskRepository.find(params);
	}
}
