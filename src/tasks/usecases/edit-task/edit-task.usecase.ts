import { Injectable, NotFoundException } from '@nestjs/common';
import { TaskRepository } from '../../task.repository';
import { MarkdownContentService } from '../../../markdown-content/services/markdown-content.service';
import { TaskStatus } from '../../task.entity';
import { TaskResponseDto } from '../../dto/task.dto';
import { UsecaseInterface } from '../../../common/interface';

@Injectable()
export class EditTaskUsecase implements UsecaseInterface {
	constructor(
		private readonly taskRepository: TaskRepository,
		private readonly markdownContentService: MarkdownContentService,
	) {}

	async execute({
		id,
		student_user_id,
		mentor_user_id,
		summary,
		markdown_content,
		deadline,
		priority,
		status,
	}: {
		id: string;
		student_user_id: string;
		mentor_user_id: string;
		summary: string;
		markdown_content: string;
		deadline: Date;
		priority: number;
		status: TaskStatus;
	}): Promise<TaskResponseDto | undefined> {
		const existingTask = await this.taskRepository.findById(id);

		if (!existingTask) {
			throw new NotFoundException('Задача не найдена');
		}

		const markdownContent = await this.markdownContentService.uploadMarkdownContent(markdown_content);

		const updatedTask = await this.taskRepository.update(id, {
			student_user_id,
			mentor_user_id,
			summary,
			markdown_content_id: markdownContent.id,
			deadline,
			priority,
			status,
		});

		return updatedTask
			? {
					...updatedTask,
					markdown_content: markdownContent.content_text,
				}
			: undefined;
	}
}
