import { Body, Controller, HttpCode, HttpStatus, Put, InternalServerErrorException } from '@nestjs/common';
import { EditTaskUsecase } from './edit-task.usecase';
import { TaskResponseDto } from '../../dto/base-task.dto';
import { ApiTags } from '@nestjs/swagger';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { UpdateTaskDto } from '../../dto/update-task.dto';

@ApiTags('Tasks')
@Controller('tasks')
@Roles('admin')
export class EditTaskController {
	constructor(private readonly editTaskUsecase: EditTaskUsecase) {}

	@Route({
		summary: 'Редактирует задачу',
		responseType: TaskResponseDto,
	})
	@Put()
	@HttpCode(HttpStatus.OK)
	async update(@Body() dto: UpdateTaskDto): Promise<TaskResponseDto> {
		const task = await this.editTaskUsecase.execute(dto);

		if (!task) {
			throw new InternalServerErrorException('Задача не обновлена');
		}

		return task;
	}
}
