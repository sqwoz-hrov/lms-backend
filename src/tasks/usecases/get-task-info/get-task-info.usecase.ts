import { Injectable, NotFoundException } from '@nestjs/common';
import { TaskRepository } from '../../task.repository';
import { MarkdownContentService } from '../../../markdown-content/services/markdown-content.service';
import { TaskResponseDto } from '../../dto/task.dto';
import { UsecaseInterface } from '../../../common/interface';

@Injectable()
export class GetTaskInfoUsecase implements UsecaseInterface {
	constructor(
		private readonly taskRepository: TaskRepository,
		private readonly markdownContentService: MarkdownContentService,
	) {}

	async execute({ id }: { id: string }): Promise<TaskResponseDto> {
		const task = await this.taskRepository.findById(id);

		if (!task) {
			throw new NotFoundException('Задача не найдена');
		}

		const markdownContent = await this.markdownContentService.getMarkdownContent(task.markdown_content_id);

		return {
			...task,
			markdown_content: markdownContent.content_text ?? '',
		};
	}
}
