import { ConfigType } from '@nestjs/config';
import { JwtService } from '../src/infra/services/jwt.service';
import { jwtConfig } from '../src/config';

export class JwtFactory {
	constructor(
		private readonly config: ConfigType<typeof jwtConfig> = {
			accessSecret: 'secret',
			refreshSecret: 'secret',
			accessExpiresInSeconds: 10 * 60 * 60,
			refreshExpiresInSeconds: 10 * 60 * 60,
			accessCookiePath: '/',
			refreshCookiePath: '/',
		},
	) {}

	public getJwtPair(userId: string) {
		const { accessToken, refreshToken } = new JwtService(this.config).generatePair({ userId });
		return { accessToken, refreshToken, userId };
	}
}
