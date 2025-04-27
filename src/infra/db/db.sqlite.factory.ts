import { SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';

const getDbPath = () => {
	const currentDir = __dirname;
	return currentDir + 'db.sqlite';
};

export const sqliteDialectFactory = () => {
	return new SqliteDialect({
		database: new Database(getDbPath()),
	});
};
