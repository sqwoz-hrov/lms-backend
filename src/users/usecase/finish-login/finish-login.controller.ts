import { Controller, Body, Post, NotFoundException, HttpCode, HttpStatus } from '@nestjs/common';

import { FinishLoginUsecase } from './finish-login.usecase';
import { FinishLoginDto } from '../dtos/finish-login.dto';

@Controller('/users/login/finish')
export class FinishLoginController {
	constructor(private readonly finishLoginUsecase: FinishLoginUsecase) {}

	@Post('/')
	@HttpCode(HttpStatus.ACCEPTED)
	public async execute(@Body() body: FinishLoginDto) {
		const res = await this.finishLoginUsecase.execute({ userEmailOrLogin: body.email, inputOtp: body.otpCode });

		if (!res.success) {
			throw new NotFoundException('Пользователя с такой почтой не нашлось :( Проверьте почту или напишите нам');
		}

		return { token: res.data.token };
	}
}
