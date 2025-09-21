import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { sign, verify } from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { jwtConfig } from '../../config';

interface JwtPayloadBase {
	userId: string;
	iat?: number;
	exp?: number;
	jti?: string;
	type: 'access' | 'refresh';
}

const payloadSchema = z
	.object({
		userId: z.string(),
		exp: z.number(),
		iat: z.number(),
		type: z.enum(['access', 'refresh']),
		jti: z.string().optional(),
	})
	.strict();

@Injectable()
export class JwtService {
	private readonly logger = new Logger(JwtService.name);

	constructor(@Inject(jwtConfig.KEY) private readonly config: ConfigType<typeof jwtConfig>) {}

	private getAccessExpiry(): `${number}s` {
		return `${this.config.accessExpiresInSeconds}s`;
	}

	private getRefreshExpiry(): `${number}s` {
		return `${this.config.refreshExpiresInSeconds}s`;
	}

	private sign(payload: Omit<JwtPayloadBase, 'exp' | 'iat'>, expiresIn: `${number}s`) {
		return sign(payload, this.config.secret, {
			expiresIn,
			algorithm: 'HS512',
		});
	}

	generatePair({ userId }: { userId: string }) {
		const accessToken = this.sign({ userId, type: 'access' }, this.getAccessExpiry());
		const refreshToken = this.sign({ userId, type: 'refresh', jti: randomUUID() }, this.getRefreshExpiry());

		return {
			accessToken,
			refreshToken,
			accessTtlMs: this.config.accessExpiresInSeconds * 1000,
			refreshTtlMs: this.config.refreshExpiresInSeconds * 1000,
		};
	}

	private async _verify(token: string, secret: string) {
		return new Promise<JwtPayloadBase | undefined>((res, rej) => {
			verify(token, secret, { algorithms: ['HS512'], complete: true }, (err, decoded) => {
				if (err) {
					rej(err);
				} else {
					res(decoded?.payload as JwtPayloadBase);
				}
			});
		});
	}

	async verify(token: string): Promise<{ success: false } | { success: true; data: JwtPayloadBase }> {
		try {
			const payload = await this._verify(token, this.config.secret);
			const resultValidation = payloadSchema.safeParse(payload);

			if (!payload || resultValidation.success === false) {
				return { success: false };
			}

			if (payload.exp! < Date.now() / 1000) {
				return { success: false };
			}

			return { success: true, data: payload };
		} catch (error) {
			this.logger.error(`Verifying JWT error: ${error}`);
			return { success: false };
		}
	}
}
