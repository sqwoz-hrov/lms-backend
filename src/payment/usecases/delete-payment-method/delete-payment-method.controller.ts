import { Controller, Delete, HttpCode, HttpStatus, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequestWithUser } from '../../../common/interface/request-with-user.interface';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { DeletePaymentMethodUsecase } from './delete-payment-method.usecase';

@ApiTags('Payments')
@Controller('payments')
export class DeletePaymentMethodController {
	constructor(private readonly deletePaymentMethodUsecase: DeletePaymentMethodUsecase) {}

	@Roles('subscriber')
	@Route({
		summary: 'Удалить сохранённый способ оплаты',
		description: 'Удаляет сохранённый способ оплаты подписки для текущего пользователя',
	})
	@Delete('payment-method')
	@HttpCode(HttpStatus.NO_CONTENT)
	async delete(@Req() req: RequestWithUser): Promise<void> {
		await this.deletePaymentMethodUsecase.execute({ user: req.user });
	}
}
