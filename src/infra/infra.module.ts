import { Global, Module } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { Redis } from 'ioredis';
import { redisConfig } from '../config/redis.config';
import { DIALECT_FACTORY_KEY } from './db/db.const';
import { postgresDialectFactory } from './db/db.postgres.factory';
import { DatabaseProvider } from './db/db.provider';
import { GracefulShutdownService } from './graceful-shutdown.service';
import { REDIS_CONNECTION_KEY } from './redis.const';
import { JwtService } from './services/jwt.service';

@Global()
@Module({
	imports: [],
	controllers: [],
	providers: [
		{
			provide: DIALECT_FACTORY_KEY,
			useFactory: () => {
				return postgresDialectFactory;
			},
		},
		DatabaseProvider,
		{
			provide: REDIS_CONNECTION_KEY,
			useFactory: (config: ConfigType<typeof redisConfig>) =>
				new Redis({
					port: config.redisPort,
					host: config.redisHost,
					username: config.redisUsername,
					password: config.redisPassword,
					lazyConnect: config.redisLazyConnect,
				}),
			inject: [redisConfig.KEY],
		},
		JwtService,
		GracefulShutdownService,
	],
	exports: [DatabaseProvider, JwtService, REDIS_CONNECTION_KEY],
})
export class InfraModule {}
