import type { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema
		.alterTable('subscription_tier')
		.addColumn('markdown_description_id', 'uuid', col => col.references('markdown_content.id').onDelete('restrict'))
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.alterTable('subscription_tier').dropColumn('markdown_description_id').execute();
}
