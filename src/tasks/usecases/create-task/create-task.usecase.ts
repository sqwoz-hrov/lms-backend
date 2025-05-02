import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { TaskRepository } from '../../task.repository';
import { MarkdownContentService } from '../../../markdown-content/services/markdown-content.service';
import { TaskResponseDto } from '../../dto/base-task.dto';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { UserRepository } from '../../../users/user.repository';
import { User } from '../../../users/user.entity';
import { CreateTaskDto } from '../../dto/create-task.dto';

@Injectable()
export class CreateTaskUsecase implements UsecaseInterface {
	constructor(
		private readonly taskRepository: TaskRepository,
		private readonly userRepository: UserRepository,
		@Inject(MarkdownContentService)
		private readonly markdownContentService: MarkdownContentService,
	) {}

	async execute({ user, params }: { user: User; params: CreateTaskDto }): Promise<TaskResponseDto | undefined> {
		if (user.role !== 'admin') {
			throw new UnauthorizedException('Вы не администратор');
		}

		const { student_user_id, mentor_user_id, summary, markdown_content, deadline, priority, status } = params;

		const student = await this.userRepository.findById(student_user_id);

		if (!student) {
			return undefined;
		}

		const mentor = await this.userRepository.findById(mentor_user_id);

		if (!mentor || mentor.role !== 'admin') {
			return undefined;
		}

		const markdownContent = await this.markdownContentService.uploadMarkdownContent(markdown_content);

		const task = await this.taskRepository.save({
			student_user_id,
			mentor_user_id,
			summary,
			markdown_content_id: markdownContent.id,
			deadline,
			priority,
			status,
		});

		return task
			? {
					...task,
					markdown_content: markdownContent.content_text,
				}
			: undefined;
	}
}
