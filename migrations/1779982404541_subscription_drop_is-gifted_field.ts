import type { Kysely } from 'kysely'

// `any` is required here since migrations should be frozen in time. alternatively, keep a "snapshot" db interface.
export async function up(db: Kysely<any>): Promise<void> {
	// up migration code goes here...
	// note: up migrations are mandatory. you must implement this function.
	// For more info, see: https://kysely.dev/docs/migrations
	await db.schema.alterTable('subscription').dropColumn('is_gifted').execute();
}

// `any` is required here since migrations should be frozen in time. alternatively, keep a "snapshot" db interface.
export async function down(db: Kysely<any>): Promise<void> {
	// down migration code goes here...
	// note: down migrations are optional. you can safely delete this function.
	// For more info, see: https://kysely.dev/docs/migrations
	await db.schema.alterTable('subscription').addColumn('is_gifted', 'boolean', (col) => col.defaultTo(null)).execute();
	await db.updateTable('subscription').set({ is_gifted: false }).execute();
	await db.schema.alterTable('subscription').alterColumn('is_gifted', (col) => col.setNotNull()).execute();
}
