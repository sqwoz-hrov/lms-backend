import type { Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema.alterTable('subscription_tier').dropConstraint('subscription_tier_power_unique').execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema
		.alterTable('subscription_tier')
		.addUniqueConstraint('subscription_tier_power_unique', ['power'])
		.execute();
}
