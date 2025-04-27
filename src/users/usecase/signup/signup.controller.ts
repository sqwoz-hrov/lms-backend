import { Body, Controller, InternalServerErrorException, Post } from '@nestjs/common';

import { SignupUsecase } from './signup.usecase';

import { CreateUserDto, UserResponseDto } from '../dtos/signup.dto';

import { Route } from '../../../common/nest/decorators/route.decorator';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Users')
@Controller('/users/signup')
export class SignupController {
	constructor(private readonly userSignupUseCase: SignupUsecase) {}

	@Route({
		summary: 'Регистрация пользователя',
		description: 'Регистрация пользователя',
		responseType: UserResponseDto,
	})
	@Post('/')
	async signup(@Body() signupDto: CreateUserDto): Promise<UserResponseDto> {
		const newUser = await this.userSignupUseCase.execute(signupDto);
		if (!newUser) {
			throw new InternalServerErrorException('User not created');
		}

		return newUser;
	}
}
