import { UserMeta, ValidateSDK } from '../../../test/test.abstract.sdk';
import { TestHttpClient } from '../../../test/test.http-client';
import { UserFactory } from '../../../test/test.user.factory';

import { ConfigType } from '@nestjs/config';
import { jwtConfig } from '../../config';
import { CreateTaskDto, DeleteTaskDto, TaskResponseDto, UpdateTaskDto } from '../dto/task.dto';

export class TasksTestSdk implements ValidateSDK<TasksTestSdk> {
	private readonly jwtFactory: UserFactory;

	constructor(
		private readonly testClient: TestHttpClient,
		jwtOptions: ConfigType<typeof jwtConfig>,
	) {
		this.jwtFactory = new UserFactory(jwtOptions);
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
}
