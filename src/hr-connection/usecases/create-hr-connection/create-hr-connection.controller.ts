import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { BaseHrConnectionDto } from '../../dto/base-hr-connection.dto';
import { CreateHrConnectionDto } from '../../dto/create-hr-connection.dto';
import { CreateHrConnectionUsecase } from './create-hr-connection.usecase';
import { RequestWithUser } from '../../../common/interface/request-with-user.interface';

@ApiTags('HR Connections')
@Controller('hr-connections')
@Roles('admin', 'user')
export class CreateHrConnectionController {
	constructor(private readonly createUsecase: CreateHrConnectionUsecase) {}

	@Route({
		summary: 'Создает контакт с HR',
		responseType: BaseHrConnectionDto,
	})
	@Post()
	@HttpCode(HttpStatus.CREATED)
	async create(@Body() dto: CreateHrConnectionDto, @Req() req: RequestWithUser): Promise<BaseHrConnectionDto> {
		const user = req['user'];
		return await this.createUsecase.execute({ params: dto, user });
	}
}
