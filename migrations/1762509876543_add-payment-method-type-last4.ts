import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema
		.alterTable('payment_method')
		.addColumn('type', 'text', col => col.notNull().defaultTo('bank_card'))
		.addColumn('last4', 'varchar(4)')
		.execute();

	await sql`UPDATE "payment_method" SET type = 'bank_card'`.execute(db);

	await db.schema
		.alterTable('payment_method')
		.alterColumn('type', col => col.dropDefault())
		.execute();

	await db.schema
		.alterTable('payment_method')
		.addCheckConstraint(
			'payment_method_last4_bank_card_check',
			sql`CASE WHEN last4 IS NOT NULL THEN type = 'bank_card' ELSE TRUE END`,
		)
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.alterTable('payment_method').dropConstraint('payment_method_last4_bank_card_check').execute();

	await db.schema.alterTable('payment_method').dropColumn('last4').execute();
	await db.schema.alterTable('payment_method').dropColumn('type').execute();
}
