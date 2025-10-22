import { Body, Controller, InternalServerErrorException, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { CreateUserDto, UserResponseDto } from '../../dto/user.dto';
import { AdminSignupUsecase } from './admin-signup.usecase';

@ApiTags('Users')
@Controller('/users/admin-signup')
@Roles('admin')
export class AdminSignupController {
	constructor(private readonly userSignupUseCase: AdminSignupUsecase) {}

	@Route({
		summary: 'Регистрация пользователя администратором',
		description: 'Регистрация пользователя администратором',
		responseType: UserResponseDto,
	})
	@Post('/')
	@HttpCode(HttpStatus.CREATED)
	async signup(@Body() signupDto: CreateUserDto): Promise<UserResponseDto> {
		const newUser = await this.userSignupUseCase.execute(signupDto);
		if (!newUser) {
			throw new InternalServerErrorException('Пользователь не создан');
		}

		return newUser;
	}
}
