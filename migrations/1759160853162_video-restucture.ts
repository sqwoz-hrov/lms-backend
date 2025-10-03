import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema
		.createType('upload_phase')
		.asEnum(['receiving', 'hashing', 'uploading_s3', 'completed', 'failed'])
		.execute();

	await db.schema
		.alterTable('video')
		.addColumn('user_id', 'uuid')
		.addColumn('filename', 'varchar(256)')
		.addColumn('mime_type', 'varchar(128)')
		.addColumn('total_size', 'bigint', col => col.notNull().defaultTo(0))
		.addColumn('chunk_size', 'bigint', col => col.notNull().defaultTo(0))
		.addColumn('tmp_path', 'varchar(512)')
		.addColumn('phase', sql`upload_phase`, col => col.notNull().defaultTo('receiving'))
		.addColumn('uploaded_ranges', 'jsonb', col => col.notNull().defaultTo(sql`'[]'::jsonb`))
		.addColumn('upload_offset', 'bigint', col => col.notNull().defaultTo(0))
		.addColumn('checksum_sha256_base64', 'varchar(64)')
		.addColumn('storage_key', 'varchar(512)')
		.addColumn('version', 'integer', col => col.notNull().defaultTo(1))
		.addColumn('updated_at', 'bigint', col => col.notNull().defaultTo(sql`(extract(epoch from now())*1000)::bigint`))
		.addColumn('created_at', 'timestamptz', col => col.notNull().defaultTo(sql`now()`))
		.execute();

	await sql`
		update "video" v
		set
			storage_key = v.s3_object_id,
			mime_type = v."contentType",
			filename = coalesce(nullif(split_part(v.s3_object_id, '/', -1), ''), v.youtube_link)
	`.execute(db);

	await db.schema
		.alterTable('video')
		.addForeignKeyConstraint('video_user_id_fkey', ['user_id'], 'user', ['id'], cb => cb.onDelete('set null'))
		.execute();

	await db.schema.createIndex('video_user_id_idx').on('video').column('user_id').execute();
	await db.schema.createIndex('video_phase_idx').on('video').column('phase').execute();

	await sql`
		create or replace function trg_video_set_updated_at_version()
		returns trigger
		language plpgsql
		as $$
		begin
			new.updated_at := (extract(epoch from now())*1000)::bigint;
			new.version := coalesce(old.version, 0) + 1;
			return new;
		end;
		$$;
	`.execute(db);

	await sql`
		drop trigger if exists video_set_updated_at_version on "video";
		create trigger video_set_updated_at_version
		before update on "video"
		for each row
		execute function trg_video_set_updated_at_version();
	`.execute(db);

	await db.schema.alterTable('video').dropColumn('youtube_link').execute();
	await db.schema.alterTable('video').dropColumn('s3_object_id').execute();
	await db.schema.alterTable('video').dropColumn('contentType').execute();

	await db.schema
		.alterTable('video')
		.alterColumn('total_size', col => col.setNotNull())
		.alterColumn('chunk_size', col => col.setNotNull())
		.alterColumn('phase', col => col.setNotNull())
		.alterColumn('uploaded_ranges', col => col.setNotNull())
		.alterColumn('upload_offset', col => col.setNotNull())
		.alterColumn('version', col => col.setNotNull())
		.alterColumn('updated_at', col => col.setNotNull())
		.alterColumn('created_at', col => col.setNotNull())
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema
		.alterTable('video')
		.addColumn('youtube_link', 'varchar(128)', col => col.defaultTo('')) // делаем nullable через default
		.addColumn('s3_object_id', 'varchar(128)')
		.addColumn('contentType', 'varchar(64)')
		.execute();

	await sql`
		update "video" v
		set
			s3_object_id = v.storage_key,
			"contentType" = v.mime_type,
			youtube_link = coalesce(v.youtube_link, '')
	`.execute(db);

	await sql`drop trigger if exists video_set_updated_at_version on "video";`.execute(db);
	await sql`drop function if exists trg_video_set_updated_at_version;`.execute(db);

	await db.schema.dropIndex('video_phase_idx').execute();
	await db.schema.dropIndex('video_user_id_idx').execute();

	await db.schema.alterTable('video').dropConstraint('video_user_id_fkey').execute();

	await db.schema
		.alterTable('video')
		.dropColumn('user_id')
		.dropColumn('filename')
		.dropColumn('mime_type')
		.dropColumn('total_size')
		.dropColumn('chunk_size')
		.dropColumn('tmp_path')
		.dropColumn('phase')
		.dropColumn('uploaded_ranges')
		.dropColumn('upload_offset')
		.dropColumn('checksum_sha256_base64')
		.dropColumn('storage_key')
		.dropColumn('version')
		.dropColumn('updated_at')
		.dropColumn('created_at')
		.execute();

	await db.schema.dropType('upload_phase').execute();
}
