import { Controller, Body, Post, HttpCode, HttpStatus, UnprocessableEntityException, Res, Req } from '@nestjs/common';
import type { Response, Request } from 'express';
import { FinishLoginUsecase } from './finish-login.usecase';
import { FinishLoginDto } from '../../dto/finish-login.dto';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { ApiTags } from '@nestjs/swagger';
import { OTP } from '../../core/otp';

@ApiTags('Users')
@Controller('/users/login/finish')
export class FinishLoginController {
	constructor(private readonly finishLoginUsecase: FinishLoginUsecase) {}

	@Route({
		summary: 'Завершение логина',
		description: 'Завершение логина (установка HttpOnly cookies)',
		responseType: Object,
	})
	@Post('/')
	@HttpCode(HttpStatus.ACCEPTED)
	public async execute(@Body() body: FinishLoginDto, @Res({ passthrough: true }) res: Response, @Req() req: Request) {
		const result = await this.finishLoginUsecase.execute({
			userEmailOrLogin: body.email,
			inputOtp: new OTP(body.otpCode),
			ip: req.ip,
			userAgent: req.get('user-agent') ?? undefined,
		});

		if (!result.success) {
			throw new UnprocessableEntityException('Неправильно введён одноразовый пароль');
		}

		for (const c of result.data.cookies) {
			res.cookie(c.name, c.value, c.options);
		}

		return { ok: true };
	}
}
