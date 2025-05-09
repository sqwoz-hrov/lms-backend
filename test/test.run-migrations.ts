import * as path from 'path';
import { Pool } from 'pg';
import { promises as fs } from 'fs';
import { Kysely, Migrator, PostgresDialect, FileMigrationProvider, SqliteDialect } from 'kysely';
import { ConfigType } from '@nestjs/config';
import Database from 'better-sqlite3';
import { dbConfig } from '../src/config';

// what we need
// 1. Up all migrations
// 2. A way to manage records (uses repository pattern & kysely itself)
// 3. For units we need sqlite driver

export const runMigrations = async (
	connectParams:
		| { useReal: false; connectionInfo: { path: string } }
		| { useReal: true; connectionInfo: ConfigType<typeof dbConfig> },
	params: {
		logs?: boolean;
	} = {},
) => {
	const db = connectParams.useReal
		? new Kysely<unknown>({
				dialect: new PostgresDialect({
					pool: new Pool({
						...connectParams.connectionInfo,
					}),
				}),
			})
		: new Kysely<unknown>({
				dialect: new SqliteDialect({
					database: new Database(connectParams.connectionInfo.path),
				}),
			});

	const migrator = new Migrator({
		db,
		provider: new FileMigrationProvider({
			fs,
			path,
			// This needs to be an absolute path.
			migrationFolder: path.join(__dirname, '../migrations'),
		}),
	});

	const { error, results } = await migrator.migrateToLatest();

	const { logs } = params;
	if (logs) {
		results?.forEach(it => {
			if (it.status === 'Success') {
				console.log(`migration "${it.migrationName}" was executed successfully`);
			} else if (it.status === 'Error') {
				console.error(`failed to execute migration "${it.migrationName}"`);
			}
		});
	}

	if (error) {
		console.error('failed to migrate');
		console.error(error);
		process.exit(1);
	}

	await db.destroy();
};
