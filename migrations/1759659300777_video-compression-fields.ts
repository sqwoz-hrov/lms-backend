// 20251005_add_gzip_tmp_path_and_compressing.ts
import { Kysely, sql } from 'kysely';

const OLD_PHASES = ['receiving', 'hashing', 'uploading_s3', 'completed', 'failed'] as const;
const NEW_PHASES = ['receiving', 'compressing', 'hashing', 'uploading_s3', 'completed', 'failed'] as const;

export async function up(db: Kysely<any>): Promise<void> {
	await sql`
		CREATE TYPE upload_phase_new AS ENUM (${sql.join(
			NEW_PHASES.map(v => sql.literal(v)),
			sql`, `,
		)});
	`.execute(db);

	await sql`ALTER TABLE "video" ALTER COLUMN "phase" DROP DEFAULT;`.execute(db);

	await sql`
		ALTER TABLE "video"
		ALTER COLUMN "phase" TYPE upload_phase_new
		USING ("phase"::text::upload_phase_new);
	`.execute(db);

	await sql`DROP TYPE upload_phase;`.execute(db);
	await sql`ALTER TYPE upload_phase_new RENAME TO upload_phase;`.execute(db);

	await sql`ALTER TABLE "video" ALTER COLUMN "phase" SET DEFAULT 'receiving'::upload_phase;`.execute(db);

	await db.schema.alterTable('video').addColumn('gzip_tmp_path', 'varchar(256)').execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.alterTable('video').dropColumn('gzip_tmp_path').execute();

	await sql`
		CREATE TYPE upload_phase_old AS ENUM (${sql.join(
			OLD_PHASES.map(v => sql.literal(v)),
			sql`, `,
		)});
	`.execute(db);

	await sql`ALTER TABLE "video" ALTER COLUMN "phase" DROP DEFAULT;`.execute(db);

	await sql`
		ALTER TABLE "video"
		ALTER COLUMN "phase" TYPE upload_phase_old
		USING (
			CASE
				WHEN "phase"::text = 'compressing' THEN 'hashing'
				ELSE "phase"::text
			END::upload_phase_old
		);
	`.execute(db);

	await sql`DROP TYPE upload_phase;`.execute(db);
	await sql`ALTER TYPE upload_phase_old RENAME TO upload_phase;`.execute(db);

	await sql`ALTER TABLE "video" ALTER COLUMN "phase" SET DEFAULT 'receiving'::upload_phase;`.execute(db);
}
