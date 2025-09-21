import { registerAs } from '@nestjs/config';
import { get } from 'env-var';

export const jwtConfig = registerAs('jwt', () => ({
	secret: get('JWT_SECRET').required().asString(),
	accessExpiresInSeconds: get('JWT_ACCESS_EXPIRES_IN_SECONDS').required().asIntPositive(),
	refreshExpiresInSeconds: get('JWT_REFRESH_EXPIRES_IN_SECONDS').required().asIntPositive(),
}));
