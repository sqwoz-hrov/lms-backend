import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequestWithUser } from '../../../common/interface/request-with-user.interface';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { CreatePaymentFormDto, PaymentFormResponseDto } from './create-payment-form.dto';
import { CreatePaymentFormUsecase } from './create-payment-form.usecase';

@ApiTags('Payments')
@Controller('payments')
export class CreatePaymentFormController {
	constructor(private readonly createPaymentFormUsecase: CreatePaymentFormUsecase) {}

	@Roles('subscriber')
	@Route({
		summary: 'Создать форму оплаты подписки',
		description: 'Генерирует платёжную форму YooKassa для выбранного тарифа подписки',
		responseType: PaymentFormResponseDto,
	})
	@Post('forms')
	@HttpCode(HttpStatus.CREATED)
	async create(@Body() dto: CreatePaymentFormDto, @Req() req: RequestWithUser): Promise<PaymentFormResponseDto> {
		const user = req.user;

		return await this.createPaymentFormUsecase.execute({
			user,
			subscription_tier_id: dto.subscription_tier_id,
		});
	}
}
