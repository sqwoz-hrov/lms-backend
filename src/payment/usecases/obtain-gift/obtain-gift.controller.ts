import { Body, Controller, Headers, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { RequestWithUser } from '../../../common/interface/request-with-user.interface';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { ObtainGiftDto, ObtainGiftResponseDto } from '../../dto/obtain-gift.dto';
import { ObtainGiftUsecase } from './obtain-gift.usecase';

@ApiTags('Payments')
@Controller('payments')
export class ObtainGiftController {
	constructor(private readonly obtainGiftUsecase: ObtainGiftUsecase) {}

	@Roles('subscriber')
	@Route({ summary: 'Получить неактивный подарок за остаток оплаченного времени', responseType: ObtainGiftResponseDto })
	@ApiHeader({ name: 'Idempotence-Key', required: true, schema: { type: 'string', format: 'uuid' } })
	@Post('obtain-gift')
	async obtain(
		@Body() dto: ObtainGiftDto,
		@Req() req: RequestWithUser,
		@Headers('idempotence-key') idempotenceKey: string,
	): Promise<ObtainGiftResponseDto> {
		const key = await new ParseUUIDPipe({ version: '4' }).transform(idempotenceKey, { type: 'custom' });
		return this.obtainGiftUsecase.execute({
			user: req.user,
			current_tier_id: dto.current_tier_id,
			idempotenceKey: key,
		});
	}
}
