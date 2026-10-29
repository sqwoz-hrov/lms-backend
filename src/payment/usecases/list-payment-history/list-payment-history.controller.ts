import { Controller, Get, HttpCode, HttpStatus, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequestWithUser } from '../../../common/interface/request-with-user.interface';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { GetPaymentHistoryDto } from '../../dto/get-payment-history.dto';
import { PaymentHistoryResponseDto } from '../../dto/payment-history-response.dto';
import { ListPaymentHistoryUsecase } from './list-payment-history.usecase';

@ApiTags('Payments')
@Controller('payments')
export class ListPaymentHistoryController {
	constructor(private readonly listPaymentHistoryUsecase: ListPaymentHistoryUsecase) {}

	@Roles('subscriber')
	@Route({
		summary: 'Получить историю успешных платежей',
		description: 'Возвращает успешные платежные события текущего пользователя от самого недавнего к самому старому',
		responseType: PaymentHistoryResponseDto,
	})
	@Get('history')
	@HttpCode(HttpStatus.OK)
	async get(@Query() query: GetPaymentHistoryDto, @Req() req: RequestWithUser): Promise<PaymentHistoryResponseDto> {
		return await this.listPaymentHistoryUsecase.execute({
			user: req.user,
			pagination: {
				page: query.page,
				pageSize: query.pageSize,
			},
		});
	}
}
