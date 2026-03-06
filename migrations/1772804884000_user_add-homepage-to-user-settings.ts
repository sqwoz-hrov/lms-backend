import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
	await db
		.updateTable('user')
		.set({
			settings: sql`jsonb_set(settings, '{homepage}', to_jsonb('home'::text), true)`,
		})
		.execute();

	await sql`
		ALTER TABLE "user"
		ADD CONSTRAINT user_settings_check
		CHECK (
			jsonb_typeof(settings) = 'object'
			AND settings ? 'theme'
			AND settings ? 'homepage'
			AND (settings->>'theme') IN ('dark', 'light')
			AND (settings->>'homepage') IN ('posts', 'home', 'transcriptions')
			AND (settings - 'theme' - 'homepage') = '{}'::jsonb
		)
	`.execute(db);

	await db.schema
		.alterTable('user')
		.alterColumn('settings', col => col.setDefault(sql`jsonb_build_object('theme', 'light', 'homepage', 'home')`))
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await sql`
		ALTER TABLE "user"
		DROP CONSTRAINT IF EXISTS user_settings_check
	`.execute(db);

	await db
		.updateTable('user')
		.set({
			settings: sql`settings - 'homepage'`,
		})
		.execute();

	await db.schema
		.alterTable('user')
		.alterColumn('settings', col => col.setDefault(sql`jsonb_build_object('theme', 'light')`))
		.execute();
}
