import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { MarkdownContentService } from '../../../markdown-content/services/markdown-content.service';
import { TaskResponseDto } from '../../dto/base-task.dto';
import { ChangeTaskStatusDto } from '../../dto/change-task-status.dto';
import { TaskRepository } from '../../task.repository';
import { User } from '../../../users/user.entity';

@Injectable()
export class ChangeTaskStatusUsecase implements UsecaseInterface {
	constructor(
		private readonly taskRepository: TaskRepository,
		private readonly markdownContentService: MarkdownContentService,
	) {}

	async execute({ user, params }: { user: User; params: ChangeTaskStatusDto }): Promise<TaskResponseDto> {
		const { id, status } = params;
		const task = await this.taskRepository.findById(id);

		if (!task) {
			throw new NotFoundException('Задача не найдена');
		}

		if (user.role === 'user' && task.student_user_id !== user.id) {
			throw new UnauthorizedException('Эта задача назначена на другого ученика');
		}

		const updated = await this.taskRepository.update(id, { status });

		if (!updated) {
			throw new NotFoundException('Задача не найдена');
		}

		const markdownContent = await this.markdownContentService.getMarkdownContent(updated.markdown_content_id);

		return {
			...updated,
			markdown_content: markdownContent.content_text,
		};
	}
}
