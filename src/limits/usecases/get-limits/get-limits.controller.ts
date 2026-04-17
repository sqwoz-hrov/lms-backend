import { Controller, Get, HttpCode, HttpStatus, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { LimitsResponseDto } from '../../dto/limits-response.dto';
import { GetLimitsUsecase } from './get-limits.usecase';
import { RequestWithUserNullableSubscriptionTier } from '../../../common/interface/request-with-user-nullable.interface';

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
	async get(@Req() req: RequestWithUserNullableSubscriptionTier): Promise<LimitsResponseDto> {
		const requester = req['user'];

		return await this.getLimitsUsecase.execute({ requester });
	}
}
