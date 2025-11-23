import { Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequestWithUser } from '../../../common/interface/request-with-user.interface';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { PaymentMethodConfirmationResponseDto } from '../../dto/payment-method-confirmation-response.dto';
import { AddPaymentMethodUsecase } from './add-payment-method.usecase';

@ApiTags('Payments')
@Controller('payments')
export class AddPaymentMethodController {
	constructor(private readonly addPaymentMethodUsecase: AddPaymentMethodUsecase) {}

	@Roles('subscriber')
	@Route({
		summary: 'Привязать способ оплаты',
		description: 'Создаёт подтверждение привязки способа оплаты для текущего пользователя',
		responseType: PaymentMethodConfirmationResponseDto,
	})
	@Post('payment-method')
	@HttpCode(HttpStatus.CREATED)
	async create(@Req() req: RequestWithUser): Promise<PaymentMethodConfirmationResponseDto> {
		return await this.addPaymentMethodUsecase.execute({ user: req.user });
	}
}
