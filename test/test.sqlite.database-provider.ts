import { DatabaseProvider } from '../src/infra/db/db.provider';
import { sqliteDialectFactory } from '../src/infra/db/db.sqlite.factory';

export const createSqliteDatabaseProvider = (path: string = './sqlite.db') => {
	const config = { path, host: '', port: 0, database: 'test', user: 'test', password: 'test' };
	const provider = new DatabaseProvider(config, sqliteDialectFactory);

	return provider;
};
