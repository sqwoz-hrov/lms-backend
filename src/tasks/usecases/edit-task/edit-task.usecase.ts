import { Injectable, NotFoundException } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { MarkdownContentService } from '../../../markdown-content/services/markdown-content.service';
import { TaskResponseDto } from '../../dto/base-task.dto';
import { UpdateTaskDto } from '../../dto/update-task.dto';
import { TaskRepository } from '../../task.repository';

@Injectable()
export class EditTaskUsecase implements UsecaseInterface {
	constructor(
		private readonly taskRepository: TaskRepository,
		private readonly markdownContentService: MarkdownContentService,
	) {}

	async execute(params: UpdateTaskDto): Promise<TaskResponseDto | undefined> {
		const { id, markdown_content, ...updates } = params;
		const existing = await this.taskRepository.findById(id);

		if (!existing) {
			throw new NotFoundException('Задача не найдена');
		}

		const markDownContent = markdown_content
			? await this.markdownContentService.updateMarkdownContent(existing.markdown_content_id, markdown_content)
			: await this.markdownContentService.getMarkdownContent(existing.markdown_content_id);

		const updatedTask = await this.taskRepository.update(id, updates);

		return {
			...updatedTask,
			markdown_content: markDownContent.content_text,
		};
	}
}
