import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema.alterTable('material').dropColumn('type').execute();
	await db.schema.dropType('material_type').execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.createType('material_type').asEnum(['video', 'article', 'book', 'course', 'other']).execute();

	await db.schema
		.alterTable('material')
		.addColumn('type', sql`material_type`, col => col.notNull().defaultTo('other'))
		.execute();

	await sql`alter table material alter column type drop default`.execute(db);
}
