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
export class RefreshTokensUsecase implements UsecaseInterface {
	constructor(
		private readonly jwtService: JwtService,
		private readonly refreshStorage: RefreshTokenRedisStorage,
		@Inject(jwtConf.KEY) private readonly jwtConfig: ConfigType<typeof jwtConf>,
		@Inject(appConf.KEY) private readonly appConfig: ConfigType<typeof appConf>,
	) {}

	public async execute({
		rawRefreshToken,
		ip,
		userAgent,
	}: {
		rawRefreshToken: string;
		ip?: string;
		userAgent?: string;
	}): Promise<
		| { success: false }
		| {
				success: true;
				data: {
					accessToken: string;
					refreshToken: string;
					accessTtlMs: number;
					refreshTtlMs: number;
					cookies: CookieInstruction[];
				};
		  }
	> {
		const decoded = this.jwtService.decode(rawRefreshToken);
		if (!decoded || decoded.type !== 'refresh') return { success: false };

		const verified = await this.jwtService.verify(rawRefreshToken);
		if (!('success' in verified) || !verified.success || verified.data.type !== 'refresh') {
			return { success: false };
		}

		const jti = decoded.jti;
		if (!jti) return { success: false };

		const record = await this.refreshStorage.getByJti(jti);
		if (!record) return { success: false };

		if (record.userId !== decoded.userId) return { success: false };
		if (record.tokenHash !== this.refreshStorage.hash(rawRefreshToken)) return { success: false };

		const { accessToken, refreshToken, accessTtlMs, refreshTtlMs } = this.jwtService.generatePair({
			userId: decoded.userId,
		});

		const nextPayload = this.jwtService.decode(refreshToken);
		if (!nextPayload?.jti) return { success: false };

		const expiresAtMs = typeof nextPayload.exp === 'number' ? nextPayload.exp * 1000 : Date.now() + refreshTtlMs;

		await this.refreshStorage.rotate(jti, {
			jti: nextPayload.jti,
			userId: decoded.userId,
			tokenHash: this.refreshStorage.hash(refreshToken),
			createdAt: Date.now(),
			expiresAt: expiresAtMs,
			ip,
			userAgent,
		});

		const cookies = this._buildCookies({ accessToken, refreshToken, accessTtlMs, refreshTtlMs });

		return {
			success: true,
			data: { accessToken, refreshToken, accessTtlMs, refreshTtlMs, cookies },
		};
	}

	private _buildCookies({
		accessToken,
		refreshToken,
		accessTtlMs,
		refreshTtlMs,
	}: {
		accessToken: string;
		refreshToken: string;
		accessTtlMs: number;
		refreshTtlMs: number;
	}): CookieInstruction[] {
		const cookieDomain = this.appConfig.cookieDomain;
		const secure = this.appConfig.useSecureCookies ?? true;
		const sameSite = this.appConfig.sameSite ?? 'lax';
		const accessPath = this.jwtConfig.accessCookiePath ?? '/';
		const refreshPath = this.jwtConfig.refreshCookiePath ?? '/';

		return [
			{
				name: 'access_token',
				value: accessToken,
				options: { httpOnly: true, secure, sameSite, domain: cookieDomain, path: accessPath, maxAge: accessTtlMs },
			},
			{
				name: 'refresh_token',
				value: refreshToken,
				options: { httpOnly: true, secure, sameSite, domain: cookieDomain, path: refreshPath, maxAge: refreshTtlMs },
			},
		];
	}
}
