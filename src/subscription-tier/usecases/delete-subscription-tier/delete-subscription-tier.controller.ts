import { Body, Controller, Delete, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { DeleteSubscriptionTierDto } from '../../dto/delete-subscription-tier.dto';
import { SubscriptionTierResponseDto } from '../../dto/base-subscription-tier.dto';
import { DeleteSubscriptionTierUsecase } from './delete-subscription-tier.usecase';

@ApiTags('Subscription Tiers')
@Controller('subscription-tiers')
@Roles('admin')
export class DeleteSubscriptionTierController {
	constructor(private readonly deleteSubscriptionTierUsecase: DeleteSubscriptionTierUsecase) {}

	@Route({
		summary: 'Удаляет тариф подписки',
		responseType: SubscriptionTierResponseDto,
	})
	@Delete()
	@HttpCode(HttpStatus.OK)
	async delete(@Body() dto: DeleteSubscriptionTierDto): Promise<SubscriptionTierResponseDto> {
		return await this.deleteSubscriptionTierUsecase.execute(dto);
	}
}
