import { PostgresDialect } from 'kysely';
import { defineConfig } from 'kysely-ctl';
import { Pool } from 'pg';
import { get } from 'env-var';

export default defineConfig({
	dialect: new PostgresDialect({
		pool: new Pool({
			host: get('POSTGRES_HOST').required().asString(),
			port: get('POSTGRES_PORT').required().asPortNumber(),
			user: get('POSTGRES_USER').required().asString(),
			password: get('POSTGRES_PASSWORD').required().asString(),
			database: get('POSTGRES_DB').required().asString(),
		}),
	}),
	migrations: {
		migrationFolder: 'migrations',
	},
	plugins: [],
	seeds: {
		seedFolder: 'seeds',
	},
});
