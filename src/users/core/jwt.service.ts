import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { sign, verify } from 'jsonwebtoken';

import { jwtConfig } from '../../config';

interface JwtPayload {
	[key: string]: any;
	iss?: string | undefined;
	sub?: string | undefined;
	aud?: string | string[] | undefined;
	exp?: number | undefined;
	nbf?: number | undefined;
	iat?: number | undefined;
	jti?: string | undefined;
}

@Injectable()
export class JwtService {
	private readonly logger = new Logger(JwtService.name);

	constructor(@Inject(jwtConfig.KEY) private readonly config: ConfigType<typeof jwtConfig>) {}

	private getExpiry(): `${number}s` {
		return `${this.config.expiresInSeconds}s`;
	}

	private async _verify(token: string, secret: string): Promise<JwtPayload | undefined> {
		return new Promise((res, rej) => {
			verify(
				token,
				secret,
				{
					algorithms: ['HS512'],
					complete: true,
				},
				(err, decoded) => {
					if (err) {
						rej(err as Error);
					}
					res(decoded);
				},
			);
		});
	}

	async verify(
		token: string,
	): Promise<{ success: false } | { success: true; data: { expires: number; userId: string } }> {
		try {
			const res = await this._verify(token, this.config.secret);
			if (!res) {
				return { success: false };
			}

			if (!('userId' in res && res.userId && typeof res.userId === 'string') || !('exp' in res && res.exp)) {
				return { success: false };
			}

			return { success: true, data: { expires: res.exp, userId: res.userId } };
		} catch (error) {
			this.logger.error(`Verifying JWT error: ${error}`);
			return { success: false };
		}
	}

	generate({ userId }: { userId: string }) {
		const token = sign({ userId }, this.config.secret, {
			expiresIn: this.getExpiry(),
		});

		return token;
	}
}
