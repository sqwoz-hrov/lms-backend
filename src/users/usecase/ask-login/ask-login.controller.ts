import { Controller, Body, Post, NotFoundException, HttpCode, HttpStatus } from '@nestjs/common';

import { AskForLoginUsecase } from './ask-login.usecase';
import { AskLoginDto } from '../dtos/ask-login.dto';

@Controller('/users/login')
export class AskForLoginController {
	constructor(private readonly askForLoginUsecase: AskForLoginUsecase) {}

	@Post('/')
	@HttpCode(HttpStatus.ACCEPTED)
	public async execute(@Body() body: AskLoginDto) {
		const res = await this.askForLoginUsecase.execute({ emailOrLogin: body.email });

		if (!res.success) {
			throw new NotFoundException('Пользователя с такой почтой не нашлось :( Проверьте почту или напишите нам');
		}

		return;
	}
}
