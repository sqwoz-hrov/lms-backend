import { SqliteDialect } from 'kysely';
import { ConfigType } from '@nestjs/config';
import Database from 'better-sqlite3';
import { dbConfig } from '../../config';

const getDbPath = () => {
	const currentDir = __dirname;
	return currentDir + 'db.sqlite';
};

export const sqliteDialectFactory = (config: Partial<ConfigType<typeof dbConfig>>) => {
	return new SqliteDialect({
		database: new Database(config.path ?? getDbPath()),
	});
};
