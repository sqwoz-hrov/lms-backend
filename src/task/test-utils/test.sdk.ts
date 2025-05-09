import { UserMeta, ValidateSDK } from '../../../test/test.abstract.sdk';
import { TestHttpClient } from '../../../test/test.http-client';
import { UserFactory } from '../../../test/test.user.factory';
import { ConfigType } from '@nestjs/config';
import { jwtConfig } from '../../config';
import { TaskResponseDto } from '../dto/base-task.dto';
import { CreateTaskDto } from '../dto/create-task.dto';
import { DeleteTaskDto } from '../dto/delete-task.dto';
import { UpdateTaskDto } from '../dto/update-task.dto';
import { GetTasksDto } from '../dto/get-tasks.dto';
import { ChangeTaskStatusDto } from '../dto/change-task-status.dto';

export class TasksTestSdk implements ValidateSDK<TasksTestSdk> {
	private readonly jwtFactory: UserFactory;

	constructor(
		private readonly testClient: TestHttpClient,
		jwtOptions: ConfigType<typeof jwtConfig>,
	) {
		this.jwtFactory = new UserFactory(jwtOptions);
	}

	public async changeTaskStatus({ params, userMeta }: { params: ChangeTaskStatusDto; userMeta: UserMeta }) {
		const user = this.jwtFactory.getToken(userMeta.userId);
		const jwt = userMeta.isAuth ? user.token : undefined;

		return this.testClient.request<TaskResponseDto>({
			path: '/tasks/change-status',
			method: 'PUT',
			body: params,
			jwt,
			wrongJwt: userMeta.isWrongJwt,
		});
	}

	public async createTask({ params, userMeta }: { params: CreateTaskDto; userMeta: UserMeta }) {
		const user = this.jwtFactory.getToken(userMeta.userId);
		const jwt = userMeta.isAuth ? user.token : undefined;

		return this.testClient.request<TaskResponseDto>({
			path: '/tasks',
			method: 'POST',
			jwt,
			wrongJwt: userMeta.isWrongJwt,
			body: params,
		});
	}

	public async deleteTask({ params, userMeta }: { params: DeleteTaskDto; userMeta: UserMeta }) {
		const user = this.jwtFactory.getToken(userMeta.userId);
		const jwt = userMeta.isAuth ? user.token : undefined;

		return this.testClient.request<TaskResponseDto>({
			path: '/tasks',
			method: 'DELETE',
			jwt,
			wrongJwt: userMeta.isWrongJwt,
			body: params,
		});
	}

	public async editTask({ params, userMeta }: { params: UpdateTaskDto; userMeta: UserMeta }) {
		const user = this.jwtFactory.getToken(userMeta.userId);
		const jwt = userMeta.isAuth ? user.token : undefined;

		return this.testClient.request<TaskResponseDto>({
			path: '/tasks',
			method: 'PUT',
			jwt,
			wrongJwt: userMeta.isWrongJwt,
			body: params,
		});
	}

	public async getTaskInfo({ params, userMeta }: { params: { id: string }; userMeta: UserMeta }) {
		const user = this.jwtFactory.getToken(userMeta.userId);
		const jwt = userMeta.isAuth ? user.token : undefined;

		return this.testClient.request<TaskResponseDto>({
			path: `/tasks/${params.id}`,
			method: 'GET',
			jwt,
			wrongJwt: userMeta.isWrongJwt,
		});
	}

	public async getTasks({ params, userMeta }: { params: GetTasksDto; userMeta: UserMeta }) {
		const user = this.jwtFactory.getToken(userMeta.userId);
		const jwt = userMeta.isAuth ? user.token : undefined;

		const queryParams = new URLSearchParams();

		for (const [key, value] of Object.entries(params)) {
			queryParams.append(key, value);
		}

		return this.testClient.request<TaskResponseDto[]>({
			path: `/tasks?${queryParams.toString()}`,
			method: 'GET',
			jwt,
			wrongJwt: userMeta.isWrongJwt,
		});
	}
}
