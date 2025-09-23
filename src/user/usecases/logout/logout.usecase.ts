import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { appConfig as appConf, jwtConfig as jwtConf } from '../../../config';
import { JwtService } from '../../../infra/services/jwt.service';
import { RefreshTokenRedisStorage } from '../../adapters/refresh-tokens-storage.adapter';

type CookieInstruction = {
	name: string;
	value: string;
	options: {
		httpOnly?: boolean;
		secure?: boolean;
		sameSite?: 'lax' | 'strict' | 'none';
		domain?: string;
		path?: string;
		maxAge?: number;
	};
};

@Injectable()
export class LogoutUsecase implements UsecaseInterface {
	constructor(
		private readonly jwtService: JwtService,
		private readonly refreshStorage: RefreshTokenRedisStorage,
		@Inject(jwtConf.KEY) private readonly jwtConfig: ConfigType<typeof jwtConf>,
		@Inject(appConf.KEY) private readonly appConfig: ConfigType<typeof appConf>,
	) {}

	public async execute(args: {
		all?: boolean;
		rawRefreshToken?: string;
		rawAccessToken?: string;
	}): Promise<{ success: false } | { success: true; data: { cookies: CookieInstruction[] } }> {
		const all = Boolean(args.all);
		if (!all) {
			if (!args.rawRefreshToken) return { success: false };
			const decoded = this.jwtService.decode(args.rawRefreshToken);
			if (!decoded || decoded.type !== 'refresh' || !decoded.jti) return { success: false };
			await this.refreshStorage.revokeByJti(decoded.jti);
			return { success: true, data: { cookies: this._clearCookies() } };
		}

		let userId: string | undefined;
		if (args.rawAccessToken) {
			const verified = await this.jwtService.verify(args.rawAccessToken);
			if ('success' in verified && verified.success && verified.data.type === 'access') {
				userId = verified.data.userId;
			}
		}
		if (!userId && args.rawRefreshToken) {
			const decoded = this.jwtService.decode(args.rawRefreshToken);
			if (decoded && decoded.type === 'refresh') userId = decoded.userId;
		}
		if (!userId) return { success: false };

		await this.refreshStorage.revokeAllForUser(userId);
		return { success: true, data: { cookies: this._clearCookies() } };
	}

	private _clearCookies(): CookieInstruction[] {
		const cookieDomain = this.appConfig.cookieDomain;
		const secure = this.appConfig.useSecureCookies ?? true;
		const sameSite = this.appConfig.sameSite ?? 'lax';
		const accessPath = this.jwtConfig.accessCookiePath ?? '/';
		const refreshPath = this.jwtConfig.refreshCookiePath ?? '/';

		return [
			{
				name: 'access_token',
				value: '',
				options: { httpOnly: true, secure, sameSite, domain: cookieDomain, path: accessPath, maxAge: 0 },
			},
			{
				name: 'refresh_token',
				value: '',
				options: { httpOnly: true, secure, sameSite, domain: cookieDomain, path: refreshPath, maxAge: 0 },
			},
		];
	}
}
