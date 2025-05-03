import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { TaskRepository } from '../../task.repository';
import { MarkdownContentService } from '../../../markdown-content/services/markdown-content.service';
import { TaskResponseDto } from '../../dto/base-task.dto';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { User } from '../../../users/user.entity';

@Injectable()
export class GetTaskInfoUsecase implements UsecaseInterface {
	constructor(
		private readonly taskRepository: TaskRepository,
		private readonly markdownContentService: MarkdownContentService,
	) {}

	async execute({ id, user }: { id: string; user: User }): Promise<TaskResponseDto> {
		const task = await this.taskRepository.findById(id);

		if (!task) {
			throw new NotFoundException('Задача не найдена');
		}

		if (user.role === 'user' && task.student_user_id !== user.id) {
			throw new UnauthorizedException('Эта задача назначена на другого ученика');
		}

		const markdownContent = await this.markdownContentService.getMarkdownContent(task.markdown_content_id);

		return {
			...task,
			markdown_content: markdownContent.content_text ?? '',
		};
	}
}
