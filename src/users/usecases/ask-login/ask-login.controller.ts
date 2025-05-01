import { Controller, Body, Post, NotFoundException, HttpCode, HttpStatus } from '@nestjs/common';

import { AskForLoginUsecase } from './ask-login.usecase';
import { AskLoginDto, AskLoginResponseDto } from '../../dto/ask-login.dto';

import { Route } from '../../../common/nest/decorators/route.decorator';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Users')
@Controller('/users/login')
export class AskForLoginController {
	constructor(private readonly askForLoginUsecase: AskForLoginUsecase) {}

	@Route({
		summary: 'Начинает процедуру логина, отправляя OTP на указанную почту',
		description: 'Идемпотентная, можно хоть 20 раз нажать',
		responseType: AskLoginResponseDto,
	})
	@Post('/')
	@HttpCode(HttpStatus.ACCEPTED)
	public async execute(@Body() body: AskLoginDto) {
		const res = await this.askForLoginUsecase.execute({ emailOrLogin: body.email });

		if (!res.success) {
			throw new NotFoundException('Пользователя с такой почтой не нашлось :( Проверьте почту или напишите нам');
		}

		return {};
	}
}
