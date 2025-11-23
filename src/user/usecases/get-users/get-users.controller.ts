import { Controller, Get, HttpCode, HttpStatus, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequestWithUser } from '../../../common/interface/request-with-user.interface';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { UserResponseDto } from '../../dto/user.dto';
import { GetUsersDto } from '../../dto/get-users.dto';
import { GetUsersUsecase } from './get-users.usecase';

@ApiTags('Users')
@Controller('users')
@Roles('admin', 'user', 'subscriber')
export class GetUsersController {
	constructor(private readonly getUsecase: GetUsersUsecase) {}

	@Route({
		summary: 'Получает список пользователей',
		responseType: UserResponseDto,
		isArray: true,
	})
	@Get()
	@HttpCode(HttpStatus.OK)
	get(@Query() query: GetUsersDto, @Req() req: RequestWithUser): Promise<UserResponseDto[]> {
		const requester = req['user'];

		return this.getUsecase.execute({ requester, filters: query });
	}
}
