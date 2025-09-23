import { registerAs } from '@nestjs/config';
import { get } from 'env-var';

export const jwtConfig = registerAs('jwt', () => ({
	accessSecret: get('JWT_ACCESS_SECRET').required().asString(),
	refreshSecret: get('JWT_REFRESH_SECRET').required().asString(),
	accessExpiresInSeconds: get('JWT_ACCESS_EXPIRES_IN_SECONDS').required().asIntPositive(),
	refreshExpiresInSeconds: get('JWT_REFRESH_EXPIRES_IN_SECONDS').required().asIntPositive(),
	accessCookiePath: get('ACCESS_COOKIE_PATH').required().asString(),
	refreshCookiePath: get('REFRESH_COOKIE_PATH').required().asString(),
}));
