import { Body, Controller, HttpCode, HttpStatus, Put, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { BaseHrConnectionDto } from '../../dto/base-hr-connection.dto';
import { UpdateHrConnectionDto } from '../../dto/update-hr-connection.dto';
import { EditHrConnectionUsecase } from './edit-hr-connection.usecase';
import { RequestWithUser } from '../../../common/interface/request-with-user.interface';

@ApiTags('HR Connections')
@Controller('hr-connections')
@Roles('admin', 'user')
export class EditHrConnectionController {
	constructor(private readonly editUsecase: EditHrConnectionUsecase) {}

	@Route({
		summary: 'Редактирует контакт с HR',
		responseType: BaseHrConnectionDto,
	})
	@Put()
	@HttpCode(HttpStatus.OK)
	async update(@Body() dto: UpdateHrConnectionDto, @Req() req: RequestWithUser): Promise<BaseHrConnectionDto> {
		const user = req['user'];
		return await this.editUsecase.execute({ params: dto, user });
	}
}
