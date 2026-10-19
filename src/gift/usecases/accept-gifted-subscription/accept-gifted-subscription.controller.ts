import { Controller, HttpCode, HttpStatus, Param, Patch, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { RequestWithUser } from '../../../common/interface/request-with-user.interface';
import { GiftAcceptedResponseDto } from '../../dto/gift-accept-response.dto';
import { AcceptGiftedSubscriptionUsecase } from './accept-gifted-subscription.usecase';

@ApiTags('Subscriptions')
@Controller('subscriptions')
export class AcceptGiftedSubscriptionController {
	constructor(private readonly usecase: AcceptGiftedSubscriptionUsecase) {}

	@Roles('subscriber')
	@Route({
		summary: 'Принять подарочную подписку',
		description: 'Пользователь принимает подарочную подписку',
		responseType: GiftAcceptedResponseDto,
	})
	@Patch('gift/:id')
	@HttpCode(HttpStatus.ACCEPTED)
	async gift(@Param('id') giftId: string, @Req() request: RequestWithUser): Promise<GiftAcceptedResponseDto | null> {
		return await this.usecase.execute({ giftRecipient: request.user, giftId });
	}
}
