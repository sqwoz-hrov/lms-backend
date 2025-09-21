import {
	Controller,
	Body,
	Post,
	HttpCode,
	HttpStatus,
	UnprocessableEntityException,
	Res,
	Inject,
} from '@nestjs/common';
import type { Response } from 'express';
import { FinishLoginUsecase } from './finish-login.usecase';
import { FinishLoginDto } from '../../dto/finish-login.dto';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { ApiTags } from '@nestjs/swagger';
import { OTP } from '../../core/otp';
import { appConfig as appConf } from '../../../config';
import { ConfigType } from '@nestjs/config';

const UNPROCESSABLE_ENTITY_ERROR_MESSAGE = 'Неправильно введён одноразовый пароль';

const ACCESS_COOKIE_NAME = 'access_token';
const REFRESH_COOKIE_NAME = 'refresh_token';

@ApiTags('Users')
@Controller('/users/login/finish')
export class FinishLoginController {
	constructor(
		private readonly finishLoginUsecase: FinishLoginUsecase,
		@Inject(appConf.KEY)
		private readonly appConfig: ConfigType<typeof appConf>,
	) {}

	@Route({
		summary: 'Завершение логина',
		description: 'Завершение логина (установка HttpOnly cookies)',
		responseType: Object,
	})
	@Post('/')
	@HttpCode(HttpStatus.ACCEPTED)
	public async execute(@Body() body: FinishLoginDto, @Res({ passthrough: true }) res: Response) {
		const result = await this.finishLoginUsecase.execute({
			userEmailOrLogin: body.email,
			inputOtp: new OTP(body.otpCode),
		});

		if (!result.success) {
			throw new UnprocessableEntityException(UNPROCESSABLE_ENTITY_ERROR_MESSAGE);
		}

		res.cookie(ACCESS_COOKIE_NAME, result.data.accessToken, {
			...this.buildCookieBase(),
			maxAge: result.data.accessTtlMs,
			path: '/',
		});

		res.cookie(REFRESH_COOKIE_NAME, result.data.refreshToken, {
			...this.buildCookieBase(),
			maxAge: result.data.refreshTtlMs,
			path: '/users',
		});

		return { ok: true };
	}

	public buildCookieBase() {
		return {
			httpOnly: true as const,
			secure: this.appConfig.useHttpOnlyCookies,
			sameSite: 'lax' as const,
		};
	}
}
