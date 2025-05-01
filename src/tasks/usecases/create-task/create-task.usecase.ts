import { Inject, Injectable } from '@nestjs/common';
import { TaskRepository } from '../../task.repository';
import { TaskStatus } from '../../task.entity';
import { MarkdownContentService } from '../../../markdown-content/services/markdown-content.service';
import { TaskResponseDto } from '../../dto/task.dto';
import { UsecaseInterface } from '../../../common/interface';
import { UserRepository } from '../../../users/user.repository';

@Injectable()
export class CreateTaskUsecase implements UsecaseInterface {
	constructor(
		private readonly taskRepository: TaskRepository,
		private readonly userRepository: UserRepository,
		@Inject(MarkdownContentService)
		private readonly markdownContentService: MarkdownContentService,
	) {}

	async execute({
		student_user_id,
		mentor_user_id,
		summary,
		markdown_content,
		deadline,
		priority,
		status,
	}: {
		student_user_id: string;
		mentor_user_id: string;
		summary: string;
		markdown_content: string;
		deadline: Date;
		priority: number;
		status: TaskStatus;
	}): Promise<TaskResponseDto | undefined> {
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
