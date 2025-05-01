import { Controller, Body, Post, NotFoundException, HttpCode, HttpStatus } from '@nestjs/common';

import { FinishLoginUsecase } from './finish-login.usecase';
import { FinishLoginDto, FinishLoginResponseDto } from '../../dto/finish-login.dto';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { ApiTags } from '@nestjs/swagger';
import { OTP } from '../../core/otp';

@ApiTags('Users')
@Controller('/users/login/finish')
export class FinishLoginController {
	constructor(private readonly finishLoginUsecase: FinishLoginUsecase) {}

	@Route({
		summary: 'Завершение логина',
		description: 'Завершение логина',
		responseType: FinishLoginResponseDto,
	})
	@Post('/')
	@HttpCode(HttpStatus.ACCEPTED)
	public async execute(@Body() body: FinishLoginDto) {
		const res = await this.finishLoginUsecase.execute({
			userEmailOrLogin: body.email,
			inputOtp: new OTP(body.otpCode),
		});

		if (!res.success) {
			throw new NotFoundException('Пользователя с такой почтой не нашлось :( Проверьте почту или напишите нам');
		}

		return { token: res.data.token };
	}
}
