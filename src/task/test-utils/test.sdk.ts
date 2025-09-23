import { UserMeta, ValidateSDK } from '../../../test/test.abstract.sdk';
import { TestHttpClient } from '../../../test/test.http-client';
import { TaskResponseDto } from '../dto/base-task.dto';
import { ChangeTaskStatusDto } from '../dto/change-task-status.dto';
import { CreateTaskDto } from '../dto/create-task.dto';
import { DeleteTaskDto } from '../dto/delete-task.dto';
import { GetTasksDto } from '../dto/get-tasks.dto';
import { UpdateTaskDto } from '../dto/update-task.dto';

export class TasksTestSdk implements ValidateSDK<TasksTestSdk> {
	constructor(private readonly testClient: TestHttpClient) {}

	public async changeTaskStatus({ params, userMeta }: { params: ChangeTaskStatusDto; userMeta: UserMeta }) {
		return this.testClient.request<TaskResponseDto>({
			path: '/tasks/change-status',
			method: 'PUT',
			body: params,
			userMeta,
		});
	}

	public async createTask({ params, userMeta }: { params: CreateTaskDto; userMeta: UserMeta }) {
		return this.testClient.request<TaskResponseDto>({
			path: '/tasks',
			method: 'POST',
			userMeta,
			body: params,
		});
	}

	public async deleteTask({ params, userMeta }: { params: DeleteTaskDto; userMeta: UserMeta }) {
		return this.testClient.request<TaskResponseDto>({
			path: '/tasks',
			method: 'DELETE',
			userMeta,
			body: params,
		});
	}

	public async editTask({ params, userMeta }: { params: UpdateTaskDto; userMeta: UserMeta }) {
		return this.testClient.request<TaskResponseDto>({
			path: '/tasks',
			method: 'PUT',
			userMeta,
			body: params,
		});
	}

	public async getTaskInfo({ params, userMeta }: { params: { id: string }; userMeta: UserMeta }) {
		return this.testClient.request<TaskResponseDto>({
			path: `/tasks/${params.id}`,
			method: 'GET',
			userMeta,
		});
	}

	public async getTasks({ params, userMeta }: { params: GetTasksDto; userMeta: UserMeta }) {
		const queryParams = new URLSearchParams();

		for (const [key, value] of Object.entries(params)) {
			queryParams.append(key, value);
		}

		return this.testClient.request<TaskResponseDto[]>({
			path: `/tasks?${queryParams.toString()}`,
			method: 'GET',
			userMeta,
		});
	}
}
