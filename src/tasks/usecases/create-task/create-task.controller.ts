import { Body, Controller, HttpCode, HttpStatus, InternalServerErrorException, Post, Req } from '@nestjs/common';
import { CreateTaskUsecase } from './create-task.usecase';
import { TaskResponseDto } from '../../dto/base-task.dto';
import { ApiTags } from '@nestjs/swagger';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { RequestWithUser } from '../../../common/interface/request-with-user.interface';
import { CreateTaskDto } from '../../dto/create-task.dto';

@ApiTags('Tasks')
@Controller('tasks')
@Roles('admin')
export class CreateTaskController {
	constructor(private readonly createTaskUseCase: CreateTaskUsecase) {}

	@Route({
		summary: 'Создает задачу',
		responseType: TaskResponseDto,
	})
	@Post()
	@HttpCode(HttpStatus.CREATED)
	async create(@Body() dto: CreateTaskDto, @Req() req: RequestWithUser): Promise<TaskResponseDto> {
		const user = req['user'];
		const task = await this.createTaskUseCase.execute({ user, params: dto });

		if (!task) {
			throw new InternalServerErrorException('Задача не создана');
		}

		return task;
	}
}
