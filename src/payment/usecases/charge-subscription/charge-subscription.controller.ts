import {
	BadRequestException,
	Body,
	Controller,
	Headers,
	HttpCode,
	HttpStatus,
	ParseUUIDPipe,
	Post,
	Req,
} from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { RequestWithUser } from '../../../common/interface/request-with-user.interface';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { ChargeSubscriptionDto, ChargeSubscriptionResponseDto } from '../../dto/charge-subscription.dto';
import { ChargeSubscriptionUsecase } from './charge-subscription.usecase';

@ApiTags('Payments')
@Controller('payments')
export class ChargeSubscriptionController {
	constructor(private readonly chargeSubscriptionUsecase: ChargeSubscriptionUsecase) {}

	@Roles('subscriber')
	@Route({
		summary: 'Оплатить подписку сохранённым способом оплаты',
		description: 'Списывает оплату через YooKassa с ранее привязанного способа оплаты за выбранный тариф',
		responseType: ChargeSubscriptionResponseDto,
	})
	@Post('charge')
	@ApiHeader({
		name: 'Idempotence-Key',
		description: 'UUID v4 that identifies this purchase attempt',
		required: true,
		schema: { type: 'string', format: 'uuid' },
	})
	@HttpCode(HttpStatus.CREATED)
	async charge(
		@Body() dto: ChargeSubscriptionDto,
		@Req() req: RequestWithUser,
		// TODO: refactor so that the validation is inside of the thing
		@Headers('idempotence-key') idempotenceKey: string | undefined,
	): Promise<ChargeSubscriptionResponseDto> {
		const user = req.user;
		if (!idempotenceKey) {
			throw new BadRequestException('Idempotence-Key header is required');
		}
		const validatedIdempotenceKey = await new ParseUUIDPipe({ version: '4' }).transform(idempotenceKey, {
			type: 'custom',
		});

		return await this.chargeSubscriptionUsecase.execute({
			user,
			current_tier_id: dto.current_tier_id,
			idempotenceKey: validatedIdempotenceKey,
		});
	}
}
