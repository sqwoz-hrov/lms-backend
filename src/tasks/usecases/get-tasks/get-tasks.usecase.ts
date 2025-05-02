import { Injectable } from '@nestjs/common';
import { TaskRepository } from '../../task.repository';
import { MarkdownContentService } from '../../../markdown-content/services/markdown-content.service';
import { TaskResponseDto } from '../../dto/base-task.dto';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { GetTasksDto } from '../../dto/get-tasks.dto';
import { User } from '../../../users/user.entity';

@Injectable()
export class GetTasksUsecase implements UsecaseInterface {
	constructor(
		private readonly taskRepository: TaskRepository,
		private readonly markdownContentService: MarkdownContentService,
	) {}

	async execute({ user, params }: { user: User; params: GetTasksDto }): Promise<TaskResponseDto[]> {
		if (user.role === 'user') {
			params.student_user_id = user.id;
			delete params.mentor_user_id;
		}

		const tasks = await this.taskRepository.find(params);

		const enrichedTasks = await Promise.all(
			tasks.map(async task => {
				const markdownContent = await this.markdownContentService.getMarkdownContent(task.markdown_content_id);
				return {
					...task,
					markdown_content: markdownContent.content_text,
				};
			}),
		);

		return enrichedTasks;
	}
}
