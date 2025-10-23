import { Kysely, sql } from 'kysely';

const SUBSCRIPTION_STATUS_VALUES = ['pending', 'active', 'past_due', 'canceled'] as const;

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema.createType('subscription_status').asEnum(SUBSCRIPTION_STATUS_VALUES).execute();

	await sql`ALTER TABLE "user" DROP CONSTRAINT IF EXISTS user_billable_fields_check`.execute(db);
	await sql`ALTER TABLE "user" DROP CONSTRAINT IF EXISTS user_subscription_tier_id_fkey`.execute(db);

	await db.schema
		.createTable('subscription')
		.addColumn('id', 'uuid', col => col.primaryKey().defaultTo(sql`uuid_generate_v7()`))
		.addColumn('user_id', 'uuid', col => col.notNull().references('user.id').onDelete('cascade'))
		.addColumn('subscription_tier_id', 'uuid', col =>
			col.notNull().references('subscription_tier.id').onDelete('restrict'),
		)
		.addColumn('status', sql`subscription_status`, col => col.notNull().defaultTo(sql`'pending'::subscription_status`))
		.addColumn('price_on_purchase_rubles', 'integer', col => col.notNull())
		.addColumn('is_gifted', 'boolean', col => col.notNull().defaultTo(false))
		.addColumn('grace_period_size', 'smallint', col => col.notNull().defaultTo(3))
		.addColumn('billing_period_days', 'smallint', col => col.notNull().defaultTo(30))
		.addColumn('payment_method_id', 'varchar')
		.addColumn('current_period_end', 'timestamp', col => col.notNull())
		.addColumn('next_billing_at', 'timestamp')
		.addColumn('billing_retry_attempts', 'integer', col => col.notNull().defaultTo(0))
		.addColumn('last_billing_attempt', 'timestamp')
		.addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`now()`))
		.addColumn('updated_at', 'timestamp', col => col.notNull().defaultTo(sql`now()`))
		.addCheckConstraint(
			'subscription_gift_billing_check',
			sql`
			CASE
				WHEN is_gifted THEN
					payment_method_id IS NULL
					AND next_billing_at IS NULL
					AND billing_retry_attempts = 0
					AND last_billing_attempt IS NULL
				ELSE
					TRUE
			END`,
		)
		.addUniqueConstraint('subscription_user_id_unique', ['user_id'])
		.execute();

	await db.schema.alterTable('payment_event').addColumn('subscription_id', 'uuid').execute();
	await db.schema
		.alterTable('payment_event')
		.addForeignKeyConstraint('payment_event_subscription_id_fkey', ['subscription_id'], 'subscription', ['id'], cb =>
			cb.onDelete('set null'),
		)
		.execute();

	await db.schema
		.alterTable('user')
		.dropColumn('subscription_tier_id')
		.dropColumn('active_until')
		.dropColumn('is_billable')
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.alterTable('payment_event').dropConstraint('payment_event_subscription_id_fkey').execute();
	await db.schema.alterTable('payment_event').dropColumn('subscription_id').execute();

	await db.schema
		.alterTable('user')
		.addColumn('subscription_tier_id', 'uuid')
		.addColumn('active_until', 'timestamp')
		.addColumn('is_billable', 'boolean', col => col.notNull().defaultTo(false))
		.execute();

	await sql`
		UPDATE "user" u
		SET
			subscription_tier_id = s.subscription_tier_id,
			active_until = s.current_period_end,
			is_billable = NOT s.is_gifted
		FROM subscription s
		WHERE s.user_id = u.id
	`.execute(db);

	await db.schema
		.alterTable('user')
		.addForeignKeyConstraint(
			'user_subscription_tier_id_fkey',
			['subscription_tier_id'],
			'subscription_tier',
			['id'],
			cb => cb.onDelete('set null'),
		)
		.execute();

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

	await db.schema.dropTable('subscription').ifExists().execute();
	await db.schema.dropType('subscription_status').ifExists().execute();
}
