import { sql, type Kysely } from 'kysely';

const USER_ROLE_OLD_VALUES = ['admin', 'user'] as const;

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema
		.createTable('subscription_tier')
		.addColumn('id', 'uuid', col => col.primaryKey().defaultTo(sql`uuid_generate_v7()`))
		.addColumn('tier', 'text', col => col.notNull().unique())
		.addColumn('permissions', sql<string[]>`text[]`, col => col.notNull().defaultTo(sql`'{}'::text[]`))
		.execute();

	await sql`BEGIN`.execute(db);
	await sql`ALTER TYPE user_role ADD VALUE 'subscriber';`.execute(db);
	await sql`COMMIT`.execute(db);

	await db.schema
		.alterTable('user')
		.addColumn('subscription_tier_id', 'uuid')
		.addColumn('active_until', 'timestamp')
		.addColumn('is_billable', 'boolean', col => col.notNull().defaultTo(false))
		.addColumn('is_archived', 'boolean', col => col.notNull().defaultTo(false))
		.execute();

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

	await db.schema
		.createTable('payment_event')
		.addColumn('id', 'uuid', col => col.primaryKey().defaultTo(sql`uuid_generate_v7()`))
		.addColumn('user_id', 'uuid', col => col.notNull())
		.addColumn('event', 'jsonb', col => col.notNull())
		.addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`now()`))
		.addForeignKeyConstraint('payment_event_user_id_fkey', ['user_id'], 'user', ['id'], cb => cb.onDelete('cascade'))
		.execute();

	await db.schema
		.createTable('subject_tier')
		.addColumn('tier_id', 'uuid', col => col.notNull())
		.addColumn('subject_id', 'uuid', col => col.notNull())
		.addPrimaryKeyConstraint('subject_tier_pkey', ['tier_id', 'subject_id'])
		.addForeignKeyConstraint('subject_tier_tier_id_fkey', ['tier_id'], 'subscription_tier', ['id'], cb =>
			cb.onDelete('cascade'),
		)
		.addForeignKeyConstraint('subject_tier_subject_id_fkey', ['subject_id'], 'subject', ['id'], cb =>
			cb.onDelete('cascade'),
		)
		.execute();

	await db.schema
		.createTable('material_tier')
		.addColumn('tier_id', 'uuid', col => col.notNull())
		.addColumn('material_id', 'uuid', col => col.notNull())
		.addPrimaryKeyConstraint('material_tier_pkey', ['tier_id', 'material_id'])
		.addForeignKeyConstraint('material_tier_tier_id_fkey', ['tier_id'], 'subscription_tier', ['id'], cb =>
			cb.onDelete('cascade'),
		)
		.addForeignKeyConstraint('material_tier_material_id_fkey', ['material_id'], 'material', ['id'], cb =>
			cb.onDelete('cascade'),
		)
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.dropTable('material_tier').execute();
	await db.schema.dropTable('subject_tier').execute();
	await db.schema.dropTable('payment_event').execute();

	await db.schema.alterTable('user').dropConstraint('user_billable_fields_check').execute();

	await db.schema.alterTable('user').dropConstraint('user_subscription_tier_id_fkey').execute();

	await sql`
		CREATE TYPE user_role_old AS ENUM (${sql.join(
			USER_ROLE_OLD_VALUES.map(role => sql.literal(role)),
			sql`, `,
		)});
	`.execute(db);

	await sql`
		ALTER TABLE "user"
		ALTER COLUMN "role" TYPE user_role_old
		USING (
			CASE
				WHEN "role"::text = 'subscriber' THEN 'user'
				ELSE "role"::text
			END::user_role_old
		);
	`.execute(db);

	await sql`DROP TYPE user_role;`.execute(db);
	await sql`ALTER TYPE user_role_old RENAME TO user_role;`.execute(db);

	await db.schema
		.alterTable('user')
		.dropColumn('subscription_tier_id')
		.dropColumn('active_until')
		.dropColumn('is_billable')
		.dropColumn('is_archived')
		.execute();

	await db.schema.dropTable('subscription_tier').execute();
}
