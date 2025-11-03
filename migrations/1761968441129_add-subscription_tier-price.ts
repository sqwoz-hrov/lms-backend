import type { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema
		.alterTable('subscription_tier')
		.addColumn('price_rubles', 'integer', col => col.notNull().defaultTo(0))
		.execute();

	await db.schema
		.alterTable('subscription_tier')
		.alterColumn('price_rubles', col => col.dropDefault())
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.alterTable('subscription_tier').dropColumn('price_rubles').execute();
}
