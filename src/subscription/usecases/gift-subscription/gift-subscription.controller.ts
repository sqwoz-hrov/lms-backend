import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { GiftSubscriptionDto } from '../../dto/gift-subscription.dto';
import { SubscriptionResponseDto } from '../../dto/subscription-response.dto';
import { GiftSubscriptionUsecase } from './gift-subscription.usecase';

@ApiTags('Subscriptions')
@Controller('subscriptions')
export class GiftSubscriptionController {
	constructor(private readonly giftSubscriptionUsecase: GiftSubscriptionUsecase) {}

	@Roles('admin')
	@Route({
		summary: 'Подарить подписку пользователю',
		description: 'Администратор выдаёт пользователю подарочную подписку',
		responseType: SubscriptionResponseDto,
	})
	@Post('gift')
	@HttpCode(HttpStatus.CREATED)
	async gift(@Body() dto: GiftSubscriptionDto): Promise<SubscriptionResponseDto | null> {
		return await this.giftSubscriptionUsecase.execute({ payload: dto });
	}
}
