import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequestWithUser } from '../../../common/interface/request-with-user.interface';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { ChargeSubscriptionDto, ChargeSubscriptionResponseDto } from '../../dto/charge-subscription.dto';
import { ChargeSubscriptionUsecase } from './charge-subscription.usecase';

@ApiTags('Payments')
@Controller('payments')
export class ChargeSubscriptionController {
	constructor(private readonly chargeSubscriptionUsecase: ChargeSubscriptionUsecase) {}

	@Roles('subscriber')
	@Route({
		summary: 'Оплатить подписку сохранённым способом оплаты',
		description: 'Списывает оплату через YooKassa с ранее привязанного способа оплаты за выбранный тариф',
		responseType: ChargeSubscriptionResponseDto,
	})
	@Post('charge')
	@HttpCode(HttpStatus.CREATED)
	async charge(
		@Body() dto: ChargeSubscriptionDto,
		@Req() req: RequestWithUser,
	): Promise<ChargeSubscriptionResponseDto> {
		const user = req.user;

		return await this.chargeSubscriptionUsecase.execute({
			user,
			subscription_tier_id: dto.subscription_tier_id,
		});
	}
}
