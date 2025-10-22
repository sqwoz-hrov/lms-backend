import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema.alterTable('user').dropConstraint('user_billable_fields_check').execute();
	await db.schema
		.alterTable('user')
		.addCheckConstraint(
			'user_billable_fields_check',
			sql`
			CASE
      		  WHEN is_billable THEN
      		    active_until IS NOT NULL
      		  ELSE
      		    active_until IS NULL
      		END`,
		)
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.alterTable('user').dropConstraint('user_billable_fields_check').execute();
	await db.schema
		.alterTable('user')
		.addCheckConstraint(
			'user_billable_fields_check',
			sql`
			CASE
      		  WHEN is_billable THEN
      		    role = 'subscriber'
      		    AND active_until IS NOT NULL
      		    AND subscription_tier_id IS NOT NULL
      		  ELSE
      		    role IN ('admin','user')
      		    AND active_until IS NULL
      		    AND subscription_tier_id IS NULL
      		END`,
		)
		.execute();
}
