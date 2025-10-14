import { Controller, Get, HttpCode, HttpStatus, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequestWithUser } from '../../../common/interface/request-with-user.interface';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { UserResponseDto } from '../../dto/user.dto';
import { GetMeUsecase } from './get-me.usecase';

@ApiTags('Users')
@Controller('users/get-me')
@Roles('admin', 'user')
export class GetMeController {
	constructor(private readonly getMeUsecase: GetMeUsecase) {}

	@Route({
		summary: 'Получает текущего пользователя',
		responseType: UserResponseDto,
	})
	@Get()
	@HttpCode(HttpStatus.OK)
	async get(@Req() req: RequestWithUser): Promise<UserResponseDto> {
		const user = req['user'];

		return this.getMeUsecase.execute({ user });
	}
}
