import { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema.alterTable('payment_method').dropConstraint('payment_method_user_id_unique').execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema
		.alterTable('payment_method')
		.addUniqueConstraint('payment_method_user_id_unique', ['user_id'])
		.execute();
}
