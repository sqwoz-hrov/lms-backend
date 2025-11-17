import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ConnectionOptions } from 'node:tls';
import { DynamicModule, Global, Logger, Module } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { Redis, RedisOptions } from 'ioredis';
import { redisConfig } from '../config/redis.config';
import { DIALECT_FACTORY_KEY } from './db/db.const';
import { postgresDialectFactory } from './db/db.postgres.factory';
import { DatabaseProvider } from './db/db.provider';
import { GracefulShutdownService } from './graceful-shutdown.service';
import { REDIS_CONNECTION_KEY } from './redis.const';
import { JwtService } from './services/jwt.service';

interface InfraModuleOptions {
	useRedisTLS: boolean;
}

@Global()
@Module({})
export class InfraModule {
	static forRoot({ useRedisTLS }: InfraModuleOptions): DynamicModule {
		const redisProvider = createRedisProvider(useRedisTLS);

		return {
			module: InfraModule,
			global: true,
			providers: [
				Logger,
				{
					provide: DIALECT_FACTORY_KEY,
					useFactory: () => {
						return postgresDialectFactory;
					},
				},
				DatabaseProvider,
				redisProvider,
				JwtService,
				GracefulShutdownService,
			],
			exports: [DatabaseProvider, JwtService, REDIS_CONNECTION_KEY],
		};
	}
}

const createRedisProvider = (useRedisTLS: boolean) => ({
	provide: REDIS_CONNECTION_KEY,
	useFactory: (config: ConfigType<typeof redisConfig>, logger: Logger) => {
		const redisOptions = buildRedisOptions(config, useRedisTLS, logger);
		return new Redis(redisOptions);
	},
	inject: [redisConfig.KEY, Logger],
});

const buildRedisOptions = (
	config: ConfigType<typeof redisConfig>,
	useRedisTLS: boolean,
	logger: Logger,
): RedisOptions => {
	const redisOptions: RedisOptions = {
		port: config.redisPort,
		host: config.redisHost,
		username: config.redisUsername,
		password: config.redisPassword,
		lazyConnect: config.redisLazyConnect,
	};

	if (useRedisTLS) {
		logger.log('Redis TLS is enabled, loading certificates');
		redisOptions.tls = buildRedisTlsOptions(config, logger);
	}

	return redisOptions;
};

const buildRedisTlsOptions = (config: ConfigType<typeof redisConfig>, logger: Logger): ConnectionOptions => {
	const ca = readCertificate(config.redisTlsCa, 'REDIS_TLS_CA', logger);
	const cert = readCertificate(config.redisTlsCert, 'REDIS_TLS_CERT', logger);
	const key = readCertificate(config.redisTlsKey, 'REDIS_TLS_KEY', logger);

	return {
		ca,
		cert,
		key,
		rejectUnauthorized: true,
	};
};

const readCertificate = (location: string, label: string, logger: Logger): Buffer => {
	const trimmedLocation = location.trim();

	if (!trimmedLocation) {
		throw new Error(`${label} is required when Redis TLS is enabled`);
	}

	const candidates = [trimmedLocation, resolve(trimmedLocation)];

	for (const candidate of candidates) {
		if (existsSync(candidate)) {
			logger.log(`${label} loaded from file path: ${candidate}`);
			return readFileSync(candidate);
		}
	}

	throw new Error(`${label} must point to an existing file, received: ${location}`);
};
