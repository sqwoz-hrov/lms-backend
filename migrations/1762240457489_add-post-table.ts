import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema
		.createTable('post')
		.addColumn('id', 'uuid', col => col.primaryKey().defaultTo(sql`uuid_generate_v7()`))
		.addColumn('title', 'varchar(128)', col => col.notNull())
		.addColumn('markdown_content_id', 'uuid', col => col.references('markdown_content.id').onDelete('cascade'))
		.addColumn('video_id', 'uuid', col => col.references('video.id').onDelete('set null'))
		.addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`now()`))
		.execute();

	await db.schema
		.createTable('post_tier')
		.addColumn('post_id', 'uuid', col => col.references('post.id').onDelete('cascade'))
		.addColumn('subscription_tier_id', 'uuid', col => col.references('subscription_tier.id').onDelete('cascade'))
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.dropTable('post_tier').execute();
	await db.schema.dropTable('post').execute();
}
