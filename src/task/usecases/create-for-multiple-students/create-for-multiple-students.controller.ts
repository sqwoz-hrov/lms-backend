import { Body, Controller, HttpCode, HttpStatus, InternalServerErrorException, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { RequestWithUser } from '../../../common/interface/request-with-user.interface';
import { TaskResponseDto } from '../../dto/base-task.dto';
import { CreateTaskForMultipleUsersDto } from '../../dto/create-task-for-multiple-users.dto';
import { CreateTaskForMultipleStudentsUsecase } from './create-for-multiple-students.usecase';

@ApiTags('Tasks')
@Controller('tasks')
@Roles('admin')
export class CreateTaskForMultipleStudentsController {
	constructor(private readonly createTaskForMultipleStudentsUsecase: CreateTaskForMultipleStudentsUsecase) {}

	@Route({
		summary: 'Создает задачи для нескольких студентов',
		responseType: TaskResponseDto,
		isArray: true,
	})
	@Post('create-for-multiple-students')
	@HttpCode(HttpStatus.CREATED)
	async create(@Body() dto: CreateTaskForMultipleUsersDto, @Req() req: RequestWithUser): Promise<TaskResponseDto[]> {
		const user = req['user'];
		const tasks = await this.createTaskForMultipleStudentsUsecase.execute({ user, params: dto });

		if (!tasks) {
			throw new InternalServerErrorException('Задачи не созданы');
		}

		return tasks;
	}
}
