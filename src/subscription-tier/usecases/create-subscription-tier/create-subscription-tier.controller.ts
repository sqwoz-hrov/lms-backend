import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { CreateSubscriptionTierDto } from '../../dto/create-subscription-tier.dto';
import { SubscriptionTierResponseDto } from '../../dto/base-subscription-tier.dto';
import { CreateSubscriptionTierUsecase } from './create-subscription-tier.usecase';

@ApiTags('Subscription Tiers')
@Controller('subscription-tiers')
@Roles('admin')
export class CreateSubscriptionTierController {
	constructor(private readonly createSubscriptionTierUsecase: CreateSubscriptionTierUsecase) {}

	@Route({
		summary: 'Создает тариф подписки',
		responseType: SubscriptionTierResponseDto,
	})
	@Post()
	@HttpCode(HttpStatus.CREATED)
	async create(@Body() dto: CreateSubscriptionTierDto): Promise<SubscriptionTierResponseDto> {
		return await this.createSubscriptionTierUsecase.execute(dto);
	}
}
