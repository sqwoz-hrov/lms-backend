import { Inject } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface';
import { MarkdownContentService } from '../../../markdown-content/services/markdown-content.service';
import { TaskResponseDto } from '../../dto/task.dto';
import { TaskRepository } from '../../task.repository';

export class DeleteTaskUsecase implements UsecaseInterface {
	constructor(
		@Inject(TaskRepository)
		private readonly repository: TaskRepository,
		private readonly markdownContentService: MarkdownContentService,
	) {}

	async execute({ id }: { id: string }): Promise<TaskResponseDto | undefined> {
		const deletedTask = await this.repository.delete(id);

		if (!deletedTask) return undefined;

		const markdownContent = await this.markdownContentService.deleteMakdownContent(deletedTask.markdown_content_id);

		return {
			...deletedTask,
			markdown_content: markdownContent?.content_text ?? '',
		};
	}
}
