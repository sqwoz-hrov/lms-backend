import { Injectable, NotFoundException } from '@nestjs/common';
import { TaskRepository } from '../../task.repository';
import { MarkdownContentService } from '../../../markdown-content/services/markdown-content.service';
import { TaskResponseDto } from '../../dto/base-task.dto';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { MarkDownContent } from '../../../markdown-content/markdown-content.entity';
import { UpdateTaskDto } from '../../dto/update-task.dto';

@Injectable()
export class EditTaskUsecase implements UsecaseInterface {
	constructor(
		private readonly taskRepository: TaskRepository,
		private readonly markdownContentService: MarkdownContentService,
	) {}

	async execute(params: UpdateTaskDto): Promise<TaskResponseDto | undefined> {
		const { id, student_user_id, mentor_user_id, summary, markdown_content, deadline, priority, status } = params;
		const existingTask = await this.taskRepository.findById(id);

		if (!existingTask) {
			throw new NotFoundException('Задача не найдена');
		}

		let markdownContent: MarkDownContent;
		if (!markdown_content) {
			markdownContent = await this.markdownContentService.getMarkdownContent(existingTask.markdown_content_id);
		} else {
			markdownContent = await this.markdownContentService.uploadMarkdownContent(markdown_content);
		}

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
