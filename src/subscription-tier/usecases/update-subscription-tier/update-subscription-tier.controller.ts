import { Body, Controller, HttpCode, HttpStatus, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { SubscriptionTierResponseDto } from '../../dto/base-subscription-tier.dto';
import { UpdateSubscriptionTierDto } from '../../dto/update-subscription-tier.dto';
import { UpdateSubscriptionTierUsecase } from './update-subscription-tier.usecase';

@ApiTags('Subscription Tiers')
@Controller('subscription-tiers')
@Roles('admin')
export class UpdateSubscriptionTierController {
	constructor(private readonly updateSubscriptionTierUsecase: UpdateSubscriptionTierUsecase) {}

	@Route({
		summary: 'Обновляет тариф подписки',
		responseType: SubscriptionTierResponseDto,
	})
	@Put()
	@HttpCode(HttpStatus.OK)
	async update(@Body() dto: UpdateSubscriptionTierDto): Promise<SubscriptionTierResponseDto> {
		return await this.updateSubscriptionTierUsecase.execute(dto);
	}
}
