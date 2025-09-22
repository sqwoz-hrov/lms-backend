import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { LogoutUsecase } from './logout.usecase';
import { LogoutDto } from '../../dto/refresh-tokens.dto';

@ApiTags('Users')
@Controller('/users/logout')
export class LogoutController {
	constructor(private readonly usecase: LogoutUsecase) {}

	@Route({
		summary: 'Выход из системы',
		description: 'Инвалидация refresh-токенов и очистка HttpOnly cookies',
		responseType: Object,
	})
	@Post('/')
	@HttpCode(HttpStatus.OK)
	public async handle(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() body: LogoutDto) {
		const rawAccessToken =
			(req.cookies?.['access_token'] as string | undefined) ??
			(req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : undefined);

		const rawRefreshToken = (req.cookies?.['refresh_token'] as string | undefined) ?? body.fallbackRefreshToken;

		const result = await this.usecase.execute({
			all: body.all,
			rawAccessToken,
			rawRefreshToken,
		});

		if (!result.success) throw new UnauthorizedException();

		for (const c of result.data.cookies) {
			res.cookie(c.name, c.value, c.options);
		}

		return { ok: true };
	}
}
