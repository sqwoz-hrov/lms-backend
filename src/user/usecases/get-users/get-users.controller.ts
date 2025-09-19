import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { UserResponseDto } from '../../dto/signup.dto';
import { GetUsersUsecase } from './get-users.usecase';

@ApiTags('Users')
@Controller('users')
@Roles('admin')
export class GetUsersController {
	constructor(private readonly getUsecase: GetUsersUsecase) {}

	@Route({
		summary: 'Получает список пользователей',
		responseType: UserResponseDto,
		isArray: true,
	})
	@Get()
	@HttpCode(HttpStatus.OK)
	get(): Promise<UserResponseDto[]> {
		return this.getUsecase.execute();
	}
}
