import { sql, type Kysely } from 'kysely'
import { STATUS_VALUES } from '../src/interview-transcription/interview-transcription.entity';

const OLD_VALUES = ['created', 'processing', 'restarted', 'done'] as const satisfies typeof STATUS_VALUES[number][];

// `any` is required here since migrations should be frozen in time. alternatively, keep a "snapshot" db interface.
export async function up(db: Kysely<any>): Promise<void> {
	// up migration code goes here...
	// note: up migrations are mandatory. you must implement this function.
	// For more info, see: https://kysely.dev/docs/migrations

	await sql`
		CREATE TYPE interview_transcription_status_new AS ENUM (${sql.join(
			STATUS_VALUES.map(v => sql.literal(v)),
			sql`, `,
		)});
	`.execute(db);

	await sql`ALTER TABLE "interview_transcription" ALTER COLUMN "status" DROP DEFAULT;`.execute(db);

	await sql`
		ALTER TABLE "interview_transcription"
		ALTER COLUMN "status" TYPE interview_transcription_status_new
		USING ("status"::text::interview_transcription_status_new);
	`.execute(db);

	await sql`DROP TYPE interview_transcription_status;`.execute(db);
	await sql`ALTER TYPE interview_transcription_status_new RENAME TO interview_transcription_status;`.execute(db);

	await sql`ALTER TABLE "interview_transcription" ALTER COLUMN "status" SET DEFAULT 'created'::interview_transcription_status;`.execute(db);
}

// `any` is required here since migrations should be frozen in time. alternatively, keep a "snapshot" db interface.
export async function down(db: Kysely<any>): Promise<void> {
	// down migration code goes here...
	// note: down migrations are optional. you can safely delete this function.
	// For more info, see: https://kysely.dev/docs/migrations
	await sql`
		CREATE TYPE interview_transcription_status_new AS ENUM (${sql.join(
			OLD_VALUES.map(v => sql.literal(v)),
			sql`, `,
		)});
	`.execute(db);

	await sql`ALTER TABLE "interview_transcription" ALTER COLUMN "status" DROP DEFAULT;`.execute(db);

	await sql`
		ALTER TABLE "interview_transcription"
		ALTER COLUMN "status" TYPE interview_transcription_status_new
		USING ("status"::text::interview_transcription_status_new);
	`.execute(db);

	await sql`DROP TYPE interview_transcription_status;`.execute(db);
	await sql`ALTER TYPE interview_transcription_status_new RENAME TO interview_transcription_status;`.execute(db);

	await sql`ALTER TABLE "interview_transcription" ALTER COLUMN "status" SET DEFAULT 'created'::interview_transcription_status;`.execute(db);
}
