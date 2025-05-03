import { Controller, Get, HttpCode, HttpStatus, Param } from '@nestjs/common';
import { GetTaskInfoUsecase } from './get-task-info.usecase';
import { TaskResponseDto } from '../../dto/base-task.dto';
import { ApiParam, ApiTags } from '@nestjs/swagger';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { Req } from '@nestjs/common';
import { RequestWithUser } from '../../../common/interface/request-with-user.interface';

@ApiTags('Tasks')
@Controller('tasks')
@Roles('admin', 'user')
export class GetTaskInfoController {
	constructor(private readonly getTaskInfoUsecase: GetTaskInfoUsecase) {}

	@Route({
		summary: 'Получает информацию о задаче',
		responseType: TaskResponseDto,
	})
	@Get(':id')
	@HttpCode(HttpStatus.OK)
	@ApiParam({ name: 'id', description: 'ID задачи', type: String })
	async get(@Param('id') id: string, @Req() req: RequestWithUser): Promise<TaskResponseDto> {
		const user = req['user'];
		return this.getTaskInfoUsecase.execute({ id, user });
	}
}
