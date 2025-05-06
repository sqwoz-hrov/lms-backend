import { Body, Controller, HttpCode, HttpStatus, Put, Req } from '@nestjs/common';
import { ChangeTaskStatusUsecase } from './change-task-status.usecase';
import { ApiTags } from '@nestjs/swagger';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { TaskResponseDto } from '../../dto/base-task.dto';
import { ChangeTaskStatusDto } from '../../dto/change-task-status.dto';
import { RequestWithUser } from '../../../common/interface/request-with-user.interface';

@ApiTags('Tasks')
@Controller('tasks')
@Roles('admin', 'user')
export class ChangeTaskStatusController {
	constructor(private readonly changeTaskStatusUsecase: ChangeTaskStatusUsecase) {}

	@Route({
		summary: 'Обновляет статус задачи',
		responseType: TaskResponseDto,
	})
	@Put('change-status')
	@HttpCode(HttpStatus.OK)
	async changeStatus(@Body() dto: ChangeTaskStatusDto, @Req() req: RequestWithUser): Promise<TaskResponseDto> {
		const user = req['user'];
		return this.changeTaskStatusUsecase.execute({ user, params: dto });
	}
}
