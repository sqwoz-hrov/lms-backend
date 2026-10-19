import { sql, type Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema.alterTable('subscription').renameColumn('subscription_tier_id', 'current_tier_id').execute();
	await db.schema.alterTable('subscription').addColumn('next_tier_id', 'uuid', col =>
			col.references('subscription_tier.id').onDelete('restrict').defaultTo(sql`NULL`)).execute();
	await db.updateTable('subscription').set({ next_tier_id: sql.ref('current_tier_id') }).execute();
	await db.schema.alterTable('subscription').alterColumn('next_tier_id', col => col.dropDefault()).alterColumn('next_tier_id', col => col.setNotNull()).execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.alterTable('subscription').dropColumn('next_tier_id').execute();
	await db.schema.alterTable('subscription').renameColumn('current_tier_id', 'subscription_tier_id').execute();
}
