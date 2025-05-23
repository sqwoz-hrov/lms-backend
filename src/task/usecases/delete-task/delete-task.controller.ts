import { Body, Controller, Delete, HttpCode, HttpStatus, InternalServerErrorException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { TaskResponseDto } from '../../dto/base-task.dto';
import { DeleteTaskUsecase } from './delete-task.usecase';
import { DeleteTaskDto } from '../../dto/delete-task.dto';

@ApiTags('Tasks')
@Controller('tasks')
@Roles('admin')
export class DeleteTaskController {
	constructor(private readonly deleteTaskUsecase: DeleteTaskUsecase) {}

	@Route({
		summary: 'Удаляет задачу',
		responseType: TaskResponseDto,
	})
	@Delete()
	@HttpCode(HttpStatus.OK)
	async create(@Body() dto: DeleteTaskDto): Promise<TaskResponseDto> {
		const task = await this.deleteTaskUsecase.execute(dto);

		if (!task) {
			throw new InternalServerErrorException('Задача не создана');
		}

		return task;
	}
}
