import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { DowngradeSubscriptionDto } from '../../dto/downgrade-subscription.dto';
import { SubscriptionResponseDto } from '../../dto/subscription-response.dto';
import { DowngradeSubscriptionUsecase } from './downgrade-subscription.usecase';
import { RequestWithUser } from '../../../common/interface/request-with-user.interface';

@ApiTags('Subscriptions')
@Controller('subscriptions')
export class DowngradeSubscriptionController {
	constructor(private readonly downgradeSubscriptionUsecase: DowngradeSubscriptionUsecase) {}

	@Roles('subscriber')
	@Route({
		summary: 'Понизить тариф подписки пользователя',
		description: 'Подписчик понижает свой тариф без списания средств',
		responseType: SubscriptionResponseDto,
	})
	@Post('downgrade')
	@HttpCode(HttpStatus.OK)
	async downgrade(
		@Req() req: RequestWithUser,
		@Body() dto: DowngradeSubscriptionDto,
	): Promise<SubscriptionResponseDto> {
		return await this.downgradeSubscriptionUsecase.execute({ payload: dto, user: req.user });
	}
}
