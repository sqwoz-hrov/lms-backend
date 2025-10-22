import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema
		.alterTable('user')
		.addColumn('finished_registration', 'boolean', col => col.notNull().defaultTo(sql`false`))
		.execute();

	await sql`UPDATE "user" SET finished_registration = telegram_id IS NOT NULL;`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.alterTable('user').dropColumn('finished_registration').execute();
}
