import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema
		.alterTable('user')
		.addColumn('finished_registration', 'boolean', col => col.notNull().defaultTo(sql`false`))
		.execute();

	await sql`UPDATE "user" SET finished_registration = telegram_id IS NOT NULL;`.execute(db);

	await db.schema
		.alterTable('user')
		.addCheckConstraint('user_finished_registration_check', sql`NOT finished_registration OR telegram_id IS NOT NULL`)
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.alterTable('user').dropConstraint('user_finished_registration_check').execute();
	await db.schema.alterTable('user').dropColumn('finished_registration').execute();
}
