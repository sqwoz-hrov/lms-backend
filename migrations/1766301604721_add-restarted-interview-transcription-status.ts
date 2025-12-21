import { Kysely, sql } from 'kysely';

const INTERVIEW_TRANSCRIPTION_STATUS_OLD_VALUES = ['created', 'processing', 'done'] as const;

export async function up(db: Kysely<any>): Promise<void> {
	await sql`BEGIN`.execute(db);
	await sql`ALTER TYPE interview_transcription_status ADD VALUE 'restarted';`.execute(db);
	await sql`COMMIT`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
	await sql`
		CREATE TYPE interview_transcription_status_old AS ENUM (${sql.join(
			INTERVIEW_TRANSCRIPTION_STATUS_OLD_VALUES.map(status => sql.literal(status)),
			sql`, `,
		)});
	`.execute(db);

	await sql`
		ALTER TABLE interview_transcription
		ALTER COLUMN status TYPE interview_transcription_status_old
		USING (
			CASE
				WHEN status::text = 'restarted' THEN 'created'
				ELSE status::text
			END::interview_transcription_status_old
		);
	`.execute(db);

	await sql`DROP TYPE interview_transcription_status;`.execute(db);
	await sql`ALTER TYPE interview_transcription_status_old RENAME TO interview_transcription_status;`.execute(db);
}
