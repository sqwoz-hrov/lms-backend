import { ConfigType } from '@nestjs/config';
import { PostgresDialect } from 'kysely';
import { dbConfig } from '../../config';
import { Pool } from 'pg';

export const postgresDialectFactory = (config: ConfigType<typeof dbConfig>) => {
	return new PostgresDialect({
		pool: new Pool({
			host: config.host,
			port: config.port,
			user: config.user,
			password: config.password,
			database: config.database,
		}),
	});
};
