import { Controller, Post, HttpCode, HttpStatus, Res, Req, UnauthorizedException, Inject, Body } from '@nestjs/common';
import type { Response, Request } from 'express';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { ApiTags } from '@nestjs/swagger';
import { RefreshTokensUsecase } from './refresh-tokens.usecase';
import { ConfigType } from '@nestjs/config';
import { jwtConfig } from '../../../config';

class RefreshBodyDto {
	fallbackToken?: string;
}

@ApiTags('Users')
@Controller('/users/refresh')
export class RefreshTokensController {
	constructor(
		private readonly usecase: RefreshTokensUsecase,
		@Inject(jwtConfig.KEY) private readonly cfg: ConfigType<typeof jwtConfig>,
	) {}

	@Route({
		summary: 'Обновление JWT по refresh',
		description: 'Ротация refresh, выдача новой пары и установка HttpOnly cookies',
		responseType: Object,
	})
	@Post('/')
	@HttpCode(HttpStatus.OK)
	public async handle(
		@Req() req: Request,
		@Res({ passthrough: true }) res: Response,
		@Body() body: RefreshBodyDto | undefined,
	) {
		const rawRefreshToken = (req.cookies?.['refresh_token'] as string | undefined) ?? body?.fallbackToken;

		if (!rawRefreshToken) throw new UnauthorizedException();

		const result = await this.usecase.execute({
			rawRefreshToken,
			ip: req.ip,
			userAgent: req.get('user-agent') ?? undefined,
		});

		if (!result.success) throw new UnauthorizedException();

		for (const c of result.data.cookies) {
			res.cookie(c.name, c.value, c.options);
		}

		return { ok: true, accessTtlMs: result.data.accessTtlMs, refreshTtlMs: result.data.refreshTtlMs };
	}
}
