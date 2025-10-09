import { randomWord } from './common.fixture';
import { TasksTestRepository } from '../../src/task/test-utils/test.repo';
import { Task } from '../../src/task/task.entity';
import { MarkDownContentTestRepository } from '../../src/markdown-content/test-utils/test.repo';
import { MarkDownContent } from '../../src/markdown-content/markdown-content.entity';
import { createTestMarkdownContent } from './markdown-content.fixture';
import { UsersTestRepository } from '../../src/user/test-utils/test.repo';
import { createTestAdmin, createTestUser } from './user.fixture';
import { User } from '../../src/user/user.entity';
import { CreateTaskDto } from '../../src/task/dto/create-task.dto';
import { CreateTaskForMultipleUsersDto } from '../../src/task/dto/create-task-for-multiple-users.dto';

export const createTestTaskDto = (studentId: string, mentorId: string = studentId): CreateTaskDto => {
	return {
		student_user_id: studentId,
		mentor_user_id: mentorId,
		summary: randomWord(),
		markdown_content: '# Sample Content',
		deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // +7 days
		priority: 1,
		status: 'todo',
	};
};

export const createTestTaskForMultipleUsersDto = (
	studentIds: string[],
	mentorId: string = studentIds[0],
): CreateTaskForMultipleUsersDto => {
	return {
		student_user_ids: studentIds,
		mentor_user_id: mentorId,
		summary: randomWord(),
		markdown_content: '# Sample Content',
		deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // +7 days
		priority: 1,
		status: 'todo',
	};
};

export const createTestTask = async (
	userRepository: UsersTestRepository,
	markdownContentRepotory: MarkDownContentTestRepository,
	taskRepository: TasksTestRepository,
	user_overrides: Partial<User> = {},
	markdown_content_overrides: Partial<MarkDownContent> = {},
	task_overrides: Partial<Task> = {},
) => {
	const mentor_user_id = task_overrides.mentor_user_id
		? task_overrides.mentor_user_id
		: (await createTestAdmin(userRepository)).id;

	const student_user_id = task_overrides.student_user_id
		? task_overrides.student_user_id
		: (await createTestUser(userRepository, user_overrides)).id;

	const markdownContent = await createTestMarkdownContent(markdownContentRepotory, markdown_content_overrides);
	return taskRepository.connection
		.insertInto('task')
		.values({
			student_user_id: student_user_id,
			mentor_user_id,
			summary: randomWord(),
			markdown_content_id: markdownContent.id,
			deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // +7 days
			priority: 1,
			status: 'todo',
			...task_overrides,
		})
		.returningAll()
		.executeTakeFirstOrThrow();
};
