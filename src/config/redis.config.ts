import { registerAs } from '@nestjs/config';
import { get } from 'env-var';

export const redisConfig = registerAs('redis', () => ({
	redisHost: get('REDIS_HOST').required().asString(),
	redisPort: get('REDIS_PORT').required().asPortNumber(),
	redisUsername: get('REDIS_USERNAME').required().asString(),
	redisPassword: get('REDIS_PASSWORD').asString(),
}));
