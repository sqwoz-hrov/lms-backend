import { Body, Controller, HttpCode, HttpStatus, Delete, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { DeleteHrConnectionDto } from '../../dto/delete-hr-connection.dto';
import { BaseHrConnectionDto } from '../../dto/base-hr-connection.dto';
import { DeleteHrConnectionUsecase } from './delete-hr-connection.usecase';
import { RequestWithUser } from '../../../common/interface/request-with-user.interface';

@ApiTags('HR Connections')
@Controller('hr-connections')
@Roles('admin', 'user')
export class DeleteHrConnectionController {
	constructor(private readonly deleteUsecase: DeleteHrConnectionUsecase) {}

	@Route({
		summary: 'Удаляет контакт с HR',
		responseType: BaseHrConnectionDto,
	})
	@Delete()
	@HttpCode(HttpStatus.OK)
	async delete(@Body() dto: DeleteHrConnectionDto, @Req() req: RequestWithUser): Promise<BaseHrConnectionDto> {
		const user = req['user'];
		return await this.deleteUsecase.execute({ params: dto, user });
	}
}
