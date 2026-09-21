import { Controller, Get, HttpCode, HttpStatus, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequestWithUser } from '../../../common/interface/request-with-user.interface';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { GetGiftsDto } from '../../dto/get-gifts.dto';
import { GetGiftsResponseDto } from '../../dto/get-gifts-response.dto';
import { GetGiftsUsecase } from './get-gifts.usecase';

@ApiTags('Gifts')
@Controller('gifts')
@Roles('admin', 'subscriber')
export class GetGiftsController {
	constructor(private readonly usecase: GetGiftsUsecase) {}

	@Route({
		summary: 'Возвращает подарочные подписки пользователя',
		description:
			'Подписчик получает подарки для себя, администратор - отправленные им подарки с поиском по email получателя',
		responseType: GetGiftsResponseDto,
	})
	@Get()
	@HttpCode(HttpStatus.OK)
	async get(@Query() query: GetGiftsDto, @Req() request: RequestWithUser): Promise<GetGiftsResponseDto> {
		return await this.usecase.execute({ query, user: request.user });
	}
}
