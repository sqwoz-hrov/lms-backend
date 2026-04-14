import { Controller, Get, HttpCode, HttpStatus, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequestWithUser } from '../../../common/interface/request-with-user.interface';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { LimitsResponseDto } from '../../dto/limits-response.dto';
import { GetLimitsUsecase } from './get-limits.usecase';

@ApiTags('Limits')
@Controller('limits')
@Roles('admin', 'user', 'subscriber')
export class GetLimitsController {
	constructor(private readonly getLimitsUsecase: GetLimitsUsecase) {}

	@Route({
		summary: 'Получает применённые и превышенные AI лимиты пользователя',
		responseType: LimitsResponseDto,
	})
	@Get()
	@HttpCode(HttpStatus.OK)
	async get(@Req() req: RequestWithUser): Promise<LimitsResponseDto> {
		const requester = req['user'];

		return await this.getLimitsUsecase.execute({ requester });
	}
}
