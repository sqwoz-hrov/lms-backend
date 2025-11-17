import { registerAs } from '@nestjs/config';
import { get } from 'env-var';

export const redisConfig = registerAs('redis', () => ({
	redisHost: get('REDIS_HOST').required().asString(),
	redisPort: get('REDIS_PORT').required().asPortNumber(),
	redisUsername: get('REDIS_USERNAME').asString(),
	redisPassword: get('REDIS_PASSWORD').required().asString(),
	redisLazyConnect: get('REDIS_LAZY_CONNECT').default('false').asBool(),
	redisTlsCa: get('REDIS_TLS_CA').default('/certs/ca.crt').asString(),
	redisTlsCert: get('REDIS_TLS_CERT').default('/certs/publisher.crt').asString(),
	redisTlsKey: get('REDIS_TLS_KEY').default('/certs/publisher.key').asString(),
}));
