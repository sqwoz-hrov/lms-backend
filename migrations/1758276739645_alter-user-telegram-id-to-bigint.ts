import type { Kysely } from 'kysely';

// `any` is required here since migrations should be frozen in time. alternatively, keep a "snapshot" db interface.
export async function up(db: Kysely<any>): Promise<void> {
	await db.schema
		.alterTable('user')
		.alterColumn('telegram_id', col => col.setDataType('bigint'))
		.execute();
}

// `any` is required here since migrations should be frozen in time. alternatively, keep a "snapshot" db interface.
export async function down(db: Kysely<any>): Promise<void> {
	await db.schema
		.alterTable('user')
		.alterColumn('telegram_id', col => col.setDataType('integer')) // or whatever the original type was
		.execute();
}
