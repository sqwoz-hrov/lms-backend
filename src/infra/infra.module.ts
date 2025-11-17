import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { ConnectionOptions } from 'node:tls';
import { DynamicModule, Global, Module } from '@nestjs/common';
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
	useFactory: (config: ConfigType<typeof redisConfig>) => {
		const redisOptions = buildRedisOptions(config, useRedisTLS);
		return new Redis(redisOptions);
	},
	inject: [redisConfig.KEY],
});

const buildRedisOptions = (config: ConfigType<typeof redisConfig>, useRedisTLS: boolean): RedisOptions => {
	const redisOptions: RedisOptions = {
		port: config.redisPort,
		host: config.redisHost,
		username: config.redisUsername,
		password: config.redisPassword,
		lazyConnect: config.redisLazyConnect,
	};

	if (useRedisTLS) {
		redisOptions.tls = buildRedisTlsOptions(config);
	}

	return redisOptions;
};

const buildRedisTlsOptions = (config: ConfigType<typeof redisConfig>): ConnectionOptions => {
	const ca = readCertificate(config.redisTlsCa, 'REDIS_TLS_CA');
	const cert = readCertificate(config.redisTlsCert, 'REDIS_TLS_CERT');
	const key = readCertificate(config.redisTlsKey, 'REDIS_TLS_KEY');

	return {
		ca,
		cert,
		key,
		rejectUnauthorized: true,
	};
};

const readCertificate = (location: string, label: string): Buffer => {
	const trimmedLocation = location.trim();

	if (!trimmedLocation) {
		throw new Error(`${label} is required when Redis TLS is enabled`);
	}

	const normalizedLocation = expandHomePath(trimmedLocation);

	const candidates = [normalizedLocation, resolve(normalizedLocation)];

	for (const candidate of candidates) {
		if (existsSync(candidate)) {
			return readFileSync(candidate);
		}
	}

	return Buffer.from(trimmedLocation.replace(/\\n/g, '\n'));
};

const expandHomePath = (targetPath: string): string => {
	if (!targetPath.startsWith('~')) {
		return targetPath;
	}

	return resolve(homedir(), targetPath.slice(1));
};
