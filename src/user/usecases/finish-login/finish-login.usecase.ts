import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { appConfig as appConf, jwtConfig as jwtConf } from '../../../config';
import { JwtService } from '../../../infra/services/jwt.service';
import { RefreshTokenRedisStorage } from '../../adapters/refresh-tokens-storage.adapter';
import { OTP } from '../../core/otp';
import { OTPService } from '../../core/otp.service';
import { UserRepository } from '../../user.repository';

type CookieInstruction = {
	name: string;
	value: string;
	options: {
		httpOnly?: boolean;
		secure?: boolean;
		sameSite?: 'lax' | 'strict' | 'none';
		domain?: string;
		path?: string;
		maxAge?: number; // ms
	};
};

@Injectable()
export class FinishLoginUsecase implements UsecaseInterface {
	constructor(
		private readonly otpService: OTPService,
		private readonly repo: UserRepository,
		private readonly jwtService: JwtService,
		private readonly refreshStorage: RefreshTokenRedisStorage,
		@Inject(jwtConf.KEY) private readonly jwtConfig: ConfigType<typeof jwtConf>,
		@Inject(appConf.KEY) private readonly appConfig: ConfigType<typeof appConf>,
	) {}

	public async execute({
		inputOtp,
		userEmailOrLogin,
		ip,
		userAgent,
	}: {
		inputOtp: OTP;
		userEmailOrLogin: string;
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
		const user = await this.repo.findByEmail(userEmailOrLogin);
		if (!user) return { success: false };

		const isValid = await this.otpService.isOtpValid({
			userId: user.id,
			userInputOtp: inputOtp,
		});
		if (!isValid) return { success: false };

		const { accessToken, refreshToken, accessTtlMs, refreshTtlMs } = this.jwtService.generatePair({ userId: user.id });

		const payload = this.jwtService.decode(refreshToken);

		if (payload === undefined) {
			throw new InternalServerErrorException('Payload is undefined');
		}

		const jti: string | undefined = payload.jti;
		const expSec: number | undefined = payload.exp;
		const now = Date.now();
		const expiresAtMs = typeof expSec === 'number' ? expSec * 1000 : now + refreshTtlMs;

		if (!jti) {
			throw new InternalServerErrorException('Refresh JWT has no jti claim');
		}

		await this.refreshStorage.save({
			jti,
			userId: user.id,
			tokenHash: this.refreshStorage.hash(refreshToken),
			createdAt: now,
			expiresAt: expiresAtMs,
			ip,
			userAgent,
		});

		const cookies = this._buildCookies({
			accessToken,
			refreshToken,
			accessTtlMs,
			refreshTtlMs,
		});

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

		const accessCookie: CookieInstruction = {
			name: 'access_token',
			value: accessToken,
			options: {
				httpOnly: true,
				secure,
				sameSite,
				domain: cookieDomain,
				path: accessPath,
				maxAge: accessTtlMs,
			},
		};

		const refreshCookie: CookieInstruction = {
			name: 'refresh_token',
			value: refreshToken,
			options: {
				httpOnly: true,
				secure,
				sameSite,
				domain: cookieDomain,
				path: refreshPath,
				maxAge: refreshTtlMs,
			},
		};

		return [accessCookie, refreshCookie];
	}
}
