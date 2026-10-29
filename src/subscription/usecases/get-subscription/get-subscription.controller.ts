import { Controller, Get, HttpCode, HttpStatus, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequestWithUser } from '../../../common/interface/request-with-user.interface';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { GetSubscriptionResponseDto } from '../../dto/get-subscription-response.dto';
import { GetSubscriptionUsecase } from './get-subscription.usecase';

@ApiTags('Subscriptions')
@Controller('subscription')
@Roles('subscriber')
export class GetSubscriptionController {
	constructor(private readonly getSubscriptionUsecase: GetSubscriptionUsecase) {}

	@Route({
		summary: 'Получить информацию о подписке пользователя',
		responseType: GetSubscriptionResponseDto,
	})
	@Get()
	@HttpCode(HttpStatus.OK)
	async get(@Req() req: RequestWithUser): Promise<GetSubscriptionResponseDto> {
		return await this.getSubscriptionUsecase.execute({ actor: req.user });
	}
}
