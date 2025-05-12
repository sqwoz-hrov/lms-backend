import { Controller, Get, HttpCode, HttpStatus, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { BaseHrConnectionDto } from '../../dto/base-hr-connection.dto';
import { GetHrConnectionsUsecase } from './get-hr-connections.usecase';
import { GetHrConnectionsDto } from '../../dto/get-hr-connections.dto';
import { RequestWithUser } from '../../../common/interface/request-with-user.interface';

@ApiTags('HR Connections')
@Controller('hr-connections')
@Roles('admin', 'user')
export class GetHrConnectionsController {
	constructor(private readonly getUsecase: GetHrConnectionsUsecase) {}

	@Route({
		summary: 'Получает список контактов с HR',
		responseType: BaseHrConnectionDto,
		isArray: true,
	})
	@Get()
	@HttpCode(HttpStatus.OK)
	get(@Query() query: GetHrConnectionsDto, @Req() req: RequestWithUser): Promise<BaseHrConnectionDto[]> {
		const user = req['user'];
		return this.getUsecase.execute({ params: query, user });
	}
}
