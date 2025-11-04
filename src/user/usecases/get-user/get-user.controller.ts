import { Controller, Get, HttpCode, HttpStatus, Param, Req } from '@nestjs/common';
import { ApiParam, ApiTags } from '@nestjs/swagger';
import { RequestWithUser } from '../../../common/interface/request-with-user.interface';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { UserResponseDto } from '../../dto/user.dto';
import { GetUserUsecase } from './get-user.usecase';

@ApiTags('Users')
@Controller('users')
@Roles('admin', 'user', 'subscriber')
export class GetUserController {
	constructor(private readonly getUserUsecase: GetUserUsecase) {}

	@Route({
		summary: 'Получает пользователя по ID',
		responseType: UserResponseDto,
	})
	@Get(':id')
	@HttpCode(HttpStatus.OK)
	@ApiParam({ name: 'id', description: 'ID пользователя', type: String })
	async get(@Param('id') id: string, @Req() req: RequestWithUser): Promise<UserResponseDto> {
		const requester = req['user'];

		return this.getUserUsecase.execute({ id, requester });
	}
}
