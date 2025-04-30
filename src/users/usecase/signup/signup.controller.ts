import { Body, Controller, InternalServerErrorException, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { SignupUsecase } from './signup.usecase';

import { CreateUserDto, UserResponseDto } from '../dtos/signup.dto';

import { Route } from '../../../common/nest/decorators/route.decorator';

import { Roles } from '../../../common/nest/decorators/roles.decorator';

@ApiTags('Users')
@Controller('/users/signup')
@Roles('admin')
export class SignupController {
	constructor(private readonly userSignupUseCase: SignupUsecase) {}

	@Route({
		summary: 'Регистрация пользователя',
		description: 'Регистрация пользователя',
		responseType: UserResponseDto,
	})
	@Post('/')
	@HttpCode(HttpStatus.CREATED)
	async signup(@Body() signupDto: CreateUserDto): Promise<UserResponseDto> {
		const newUser = await this.userSignupUseCase.execute(signupDto);
		if (!newUser) {
			throw new InternalServerErrorException('User not created');
		}

		return newUser;
	}
}
