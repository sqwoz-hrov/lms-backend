import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { SubscriptionTierResponseDto } from '../../dto/base-subscription-tier.dto';
import { GetSubscriptionTiersUsecase } from './get-subscription-tiers.usecase';

@ApiTags('Subscription Tiers')
@Controller('subscription-tiers')
@Roles('admin', 'subscriber')
export class GetSubscriptionTiersController {
	constructor(private readonly getSubscriptionTiersUsecase: GetSubscriptionTiersUsecase) {}

	@Route({
		summary: 'Возвращает список тарифов подписки',
		responseType: SubscriptionTierResponseDto,
		isArray: true,
	})
	@Get()
	@HttpCode(HttpStatus.OK)
	async get(): Promise<SubscriptionTierResponseDto[]> {
		return await this.getSubscriptionTiersUsecase.execute();
	}
}
