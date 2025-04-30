import { Injectable, Inject, OnApplicationShutdown, Logger } from '@nestjs/common';
import { REDIS_CONNECTION_KEY } from './redis.const';
import { Redis } from 'ioredis';
import { DatabaseProvider } from './db/db.provider';
import { Kysely } from 'kysely';

@Injectable()
export class GracefulShutdownService implements OnApplicationShutdown {
	private readonly logger = new Logger(GracefulShutdownService.name);
	private readonly dbConnection: Kysely<any>;

	constructor(
		@Inject(REDIS_CONNECTION_KEY) private readonly redis: Redis,
		@Inject(DatabaseProvider) dbProvider: DatabaseProvider,
	) {
		this.dbConnection = dbProvider.getDatabase<any>();
	}

	private async shutdownRedis() {
		try {
			this.logger.log('Closing Redis connection...');
			await this.redis.quit();
			this.logger.log('Redis connection closed.');
		} catch (err) {
			this.logger.error('Error closing Redis:', err);
		}
	}

	private async shutdownKysely() {
		try {
			this.logger.log('Destroying Kysely DB connection...');
			await this.dbConnection.destroy();
			this.logger.log('Kysely connection destroyed.');
		} catch (err) {
			this.logger.error('Error destroying Kysely DB connection:', err);
		}
	}

	async onApplicationShutdown(signal: string) {
		this.logger.log(`Application shutdown signal received: ${signal}`);

		await this.shutdownRedis();
		await this.shutdownKysely();
	}
}
