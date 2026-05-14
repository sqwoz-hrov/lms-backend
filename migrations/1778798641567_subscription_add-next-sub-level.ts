import { sql, type Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema.alterTable('subscription').renameColumn('subscription_tier_id', 'current_tier_id').execute();
	await db.schema.alterTable('subscription').addColumn('next_tier_id', 'uuid', col =>
			col.notNull().references('subscription_tier.id').onDelete('restrict')).execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.alterTable('subscription').dropColumn('next_tier_id').execute();
	await db.schema.alterTable('subscription').renameColumn('current_tier_id', 'subscription_tier_id').execute();
}
