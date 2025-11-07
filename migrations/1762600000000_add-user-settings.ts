import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema
		.alterTable('user')
		.addColumn('settings', 'jsonb', col => col.notNull().defaultTo(sql`jsonb_build_object('theme', 'light')`))
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.alterTable('user').dropColumn('settings').execute();
}
