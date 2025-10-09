import type { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema
		.alterTable('material')
		.alterColumn('name', col => col.setDataType('varchar(256)'))
		.execute();
	await db.schema
		.alterTable('subject')
		.alterColumn('name', col => col.setDataType('varchar(256)'))
		.execute();
	await db.schema
		.alterTable('task')
		.alterColumn('summary', col => col.setDataType('varchar(256)'))
		.execute();
	await db.schema
		.alterTable('hr_connection')
		.alterColumn('name', col => col.setDataType('varchar(256)'))
		.execute();
	await db.schema
		.alterTable('journal_record')
		.alterColumn('name', col => col.setDataType('varchar(256)'))
		.execute();
	await db.schema
		.alterTable('interview')
		.alterColumn('name', col => col.setDataType('varchar(256)'))
		.execute();
	await db.schema
		.alterTable('user')
		.alterColumn('name', col => col.setDataType('varchar(256)'))
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema
		.alterTable('material')
		.alterColumn('name', col => col.setDataType('varchar(64)'))
		.execute();
	await db.schema
		.alterTable('subject')
		.alterColumn('name', col => col.setDataType('varchar(64)'))
		.execute();
	await db.schema
		.alterTable('task')
		.alterColumn('summary', col => col.setDataType('varchar(128)'))
		.execute();
	await db.schema
		.alterTable('hr_connection')
		.alterColumn('name', col => col.setDataType('varchar(64)'))
		.execute();
	await db.schema
		.alterTable('journal_record')
		.alterColumn('name', col => col.setDataType('varchar(64)'))
		.execute();
	await db.schema
		.alterTable('interview')
		.alterColumn('name', col => col.setDataType('varchar(64)'))
		.execute();
	await db.schema
		.alterTable('user')
		.alterColumn('name', col => col.setDataType('varchar(64)'))
		.execute();
}
