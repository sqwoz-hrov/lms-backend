import { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema.alterTable('video').addColumn('transcription_audio_storage_key', 'varchar(512)').execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.alterTable('video').dropColumn('transcription_audio_storage_key').execute();
}
