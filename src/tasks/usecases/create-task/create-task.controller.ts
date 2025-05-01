import { Body, Controller, HttpCode, HttpStatus, InternalServerErrorException, Post } from '@nestjs/common';
import { CreateTaskUsecase } from './create-task.usecase';
import { CreateTaskDto, TaskResponseDto } from '../../dto/task.dto';
import { ApiTags } from '@nestjs/swagger';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { Roles } from '../../../common/nest/decorators/roles.decorator';

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
	async create(@Body() dto: CreateTaskDto): Promise<TaskResponseDto> {
		const task = await this.createTaskUseCase.execute(dto);

		if (!task) {
			throw new InternalServerErrorException('Задача не создана');
		}

		return task;
	}
}
