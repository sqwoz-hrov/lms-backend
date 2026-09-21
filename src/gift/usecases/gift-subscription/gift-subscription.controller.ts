import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { GiftSubscriptionUsecase } from './gift-subscription.usecase';
import { GiftSubscriptionDto } from '../../dto/gift-subscription.dto';
import { RequestWithUser } from '../../../common/interface/request-with-user.interface';
import { GiftSubscriptionResponseDto } from '../../dto/gift-response.dto';

@ApiTags('Subscriptions')
@Controller('subscriptions')
export class GiftSubscriptionController {
	constructor(private readonly giftSubscriptionUsecase: GiftSubscriptionUsecase) {}

	@Roles('admin')
	@Route({
		summary: 'Подарить подписку пользователю',
		description: 'Администратор выдаёт пользователю подарочную подписку',
		responseType: GiftSubscriptionResponseDto,
	})
	@Post('gift')
	@HttpCode(HttpStatus.CREATED)
	async gift(
		@Body() dto: GiftSubscriptionDto,
		@Req() request: RequestWithUser,
	): Promise<GiftSubscriptionResponseDto | null> {
		return await this.giftSubscriptionUsecase.execute({ payload: dto, actor: request.user.id });
	}
}
