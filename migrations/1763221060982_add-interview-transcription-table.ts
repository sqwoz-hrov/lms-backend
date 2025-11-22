import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema.createType('interview_transcription_status').asEnum(['created', 'processing', 'done']).execute();

	await db.schema
		.createTable('interview_transcription')
		.addColumn('id', 'uuid', col => col.primaryKey().defaultTo(sql`uuid_generate_v7()`))
		.addColumn('video_id', 'uuid', col => col.notNull().references('video.id').onDelete('cascade'))
		.addColumn('status', sql`interview_transcription_status`, col =>
			col.notNull().defaultTo(sql`'created'::interview_transcription_status`),
		)
		.addColumn('s3_transcription_key', 'varchar(512)')
		.addColumn('created_at', 'timestamptz', col => col.notNull().defaultTo(sql`now()`))
		.addColumn('updated_at', 'timestamptz', col => col.notNull().defaultTo(sql`now()`))
		.execute();

	await db.schema
		.createIndex('interview_transcription_video_id_idx')
		.on('interview_transcription')
		.column('video_id')
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.dropIndex('interview_transcription_video_id_idx').execute();
	await db.schema.dropTable('interview_transcription').execute();
	await db.schema.dropType('interview_transcription_status').execute();
}
