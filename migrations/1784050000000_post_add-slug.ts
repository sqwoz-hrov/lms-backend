import type { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema.alterTable('post').addColumn('slug', 'varchar(512)').execute();

	await db.schema.createIndex('post_slug_unique').on('post').column('slug').unique().execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.dropIndex('post_slug_unique').execute();
	await db.schema.alterTable('post').dropColumn('slug').execute();
}
