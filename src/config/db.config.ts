import { registerAs } from '@nestjs/config';
import { get } from 'env-var';

export const dbConfig = registerAs('database', () => ({
	host: get('POSTGRES_HOST').required().asString(),
	port: get('POSTGRES_PORT').required().asPortNumber(),
	user: get('POSTGRES_USER').required().asString(),
	password: get('POSTGRES_PASSWORD').required().asString(),
	database: get('POSTGRES_DB').required().asString(),
	path: get('SQLITE_PATH').default('./db.sqlite').asString(),
}));
