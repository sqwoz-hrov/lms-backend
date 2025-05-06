import { Controller, Get, HttpCode, HttpStatus, Query, Req } from '@nestjs/common';
import { GetTasksUsecase } from './get-tasks.usecase';
import { TaskResponseDto } from '../../dto/base-task.dto';
import { ApiTags } from '@nestjs/swagger';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { GetTasksDto } from '../../dto/get-tasks.dto';
import { RequestWithUser } from '../../../common/interface/request-with-user.interface';

@ApiTags('Tasks')
@Controller('tasks')
@Roles('admin', 'user')
export class GetTasksController {
	constructor(private readonly getTasksUsecase: GetTasksUsecase) {}

	@Route({
		summary: 'Получает список задач',
		responseType: TaskResponseDto,
		isArray: true,
	})
	@Get()
	@HttpCode(HttpStatus.OK)
	async get(@Query() query: GetTasksDto, @Req() req: RequestWithUser): Promise<TaskResponseDto[]> {
		const user = req['user'];
		return this.getTasksUsecase.execute({ user, params: query });
	}
}
