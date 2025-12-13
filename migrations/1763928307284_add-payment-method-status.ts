import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema.createType('payment_method_status').asEnum(['pending', 'active']).execute();

	await db.schema
		.alterTable('payment_method')
		.addColumn('status', sql`payment_method_status`, col =>
			col.notNull().defaultTo(sql`'pending'::payment_method_status`),
		)
		.execute();

	await sql`UPDATE payment_method SET status = 'active'::payment_method_status`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.alterTable('payment_method').dropColumn('status').execute();
	await db.schema.dropType('payment_method_status').execute();
}
