import { Global, Module } from '@nestjs/common';
import { Redis } from 'ioredis';

import { DatabaseProvider } from './db/db.provider';
import { postgresDialectFactory } from './db/db.postgres.factory';
import { DIALECT_FACTORY_KEY } from './db/db.const';
import { REDIS_CONNECTION_KEY } from './redis.const';

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
		{
			provide: REDIS_CONNECTION_KEY,
			useClass: Redis,
		},
		DatabaseProvider,
	],
	exports: [DatabaseProvider],
})
export class InfraModule {}
