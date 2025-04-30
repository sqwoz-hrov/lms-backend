import { registerAs } from '@nestjs/config';
import { get } from 'env-var';

export const jwtConfig = registerAs('jwt', () => ({
	secret: get('JWT_SECRET').required().asString(),
	expiresInSeconds: get('JWT_EXPIRES_IN_SECONDS').required().asIntPositive(),
}));
