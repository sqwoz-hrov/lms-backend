import type { Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema.alterTable('subscription_tier')
		.addColumn('is_archived', 'boolean')
		.execute();
	await db.updateTable('subscription_tier')
		.set({
			is_archived: false,
		})
		.execute();
	await db.schema.alterTable('subscription_tier')
		.alterColumn('is_archived', (col) => col.setNotNull())
		.execute();
	await db.schema.alterTable('subscription_tier')
		.alterColumn('is_archived', (col) => col.setDefault(false))
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.alterTable('subscription_tier').dropColumn('is_archived').execute();
}
