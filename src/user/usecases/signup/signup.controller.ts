import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { PublicSignupDto, UserResponseDto } from '../../dto/user.dto';
import { SignupUsecase } from './signup.usecase';

@ApiTags('Users')
@Controller('/users/signup')
export class SignupController {
	constructor(private readonly userSignupUseCase: SignupUsecase) {}

	@Route({
		summary: 'Регистрация подписчика',
		description: 'Регистрация нового подписчика',
		responseType: UserResponseDto,
	})
	@Post('/')
	@HttpCode(HttpStatus.CREATED)
	async signup(@Body() signupDto: PublicSignupDto): Promise<UserResponseDto> {
		const newUser = await this.userSignupUseCase.execute(signupDto);

		return newUser;
	}
}
