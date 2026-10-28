import type { Kysely } from 'kysely'
import { sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema
		.createTable('gift')
		.addColumn('id', 'uuid', (col) =>
			col.primaryKey().notNull().defaultTo(sql`uuid_generate_v7()`),
		)
		.addColumn('gifted_to', 'uuid', (col) => col.notNull().references('user.id').onDelete('cascade'))
		.addColumn('gifted_by', 'uuid', (col) => col.notNull().references('user.id').onDelete('no action'))
		.addColumn('tier_id', 'uuid', (col) =>
			col.notNull().references('subscription_tier.id').onDelete('restrict'),
		)
		.addColumn('activated_at', 'timestamptz', (col) => col.defaultTo(null))
		.addColumn('duration_days', 'smallint', (col) => col.notNull())
		.execute();

	await db.schema
		.createIndex('gift_gifted_to_hash_idx')
		.on('gift')
		.column('gifted_to')
		.using('hash')
		.execute();

	await db.schema
		.createIndex('gift_gifted_by_hash_idx')
		.on('gift')
		.column('gifted_by')
		.using('hash')
		.execute();

	await sql`
		CREATE OR REPLACE FUNCTION enforce_single_active_gift()
		RETURNS trigger
		LANGUAGE plpgsql
		AS $$
		BEGIN
			IF NEW.activated_at IS NOT NULL
				AND NEW.activated_at + INTERVAL '1 day' * NEW.duration_days > now() THEN
				IF EXISTS (
					SELECT 1
					FROM gift g
					WHERE g.gifted_to = NEW.gifted_to
						AND g.id <> NEW.id
						AND g.activated_at IS NOT NULL
						AND g.activated_at + INTERVAL '1 day' * g.duration_days > now()
				) THEN
					RAISE EXCEPTION 'User % already has an active gift subscription', NEW.gifted_to
						USING ERRCODE = '23514';
				END IF;
			END IF;

			RETURN NEW;
		END;
		$$;
	`.execute(db);

	await sql`
		CREATE TRIGGER gift_single_active_subscription_trg
		BEFORE INSERT OR UPDATE OF gifted_to, activated_at, duration_days
		ON gift
		FOR EACH ROW
		EXECUTE FUNCTION enforce_single_active_gift();
	`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
	await sql`DROP TRIGGER IF EXISTS gift_single_active_subscription_trg ON gift;`.execute(db);
	await sql`DROP FUNCTION IF EXISTS enforce_single_active_gift();`.execute(db);
	await db.schema.dropIndex('gift_gifted_to_hash_idx').execute();
	await db.schema.dropIndex('gift_gifted_by_hash_idx').execute();
	await db.schema.dropTable('gift').execute();
}
