import { Controller, Get, HttpCode, HttpStatus, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequestWithUser } from '../../../common/interface/request-with-user.interface';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { PaymentMethodResponseDto } from '../../dto/payment-method-response.dto';
import { GetActivePaymentMethodUsecase } from './get-active-payment-method.usecase';

@ApiTags('Payments')
@Controller('payments')
export class GetActivePaymentMethodController {
	constructor(private readonly getActivePaymentMethodUsecase: GetActivePaymentMethodUsecase) {}

	@Roles('subscriber')
	@Route({
		summary: 'Получить активный способ оплаты',
		description: 'Возвращает активный (сохранённый) способ оплаты подписки для текущего пользователя',
		responseType: PaymentMethodResponseDto,
	})
	@Get('payment-method')
	@HttpCode(HttpStatus.OK)
	async get(@Req() req: RequestWithUser): Promise<PaymentMethodResponseDto> {
		return await this.getActivePaymentMethodUsecase.execute({ user: req.user });
	}
}
