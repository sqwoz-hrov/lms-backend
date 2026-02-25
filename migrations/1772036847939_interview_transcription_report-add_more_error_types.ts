import { sql, type Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema.alterTable('interview_transcription_report').dropConstraint('llm_report_parsed_valid').execute();
	await sql`DROP FUNCTION IF EXISTS validate_llm_report_parsed(jsonb)`.execute(db);
	await sql`
		CREATE OR REPLACE FUNCTION validate_llm_report_parsed(report jsonb) RETURNS boolean
		LANGUAGE sql IMMUTABLE STRICT AS $$
			SELECT bool_and(
				(elem->>'hintType') IN ('error', 'note', 'praise')
				AND (elem->>'lineId') IS NOT NULL
				AND (elem->>'topic') IS NOT NULL
				AND CASE elem->>'hintType'
					WHEN 'error' THEN
						(elem->>'errorType') IN ('blunder', 'inaccuracy', 'missedWin', 'mistake')
						AND (elem->>'whyBad') IS NOT NULL
						AND (elem->>'howToFix') IS NOT NULL
					WHEN 'note' THEN
						(elem->>'note') IS NOT NULL
					WHEN 'praise' THEN
						(elem->>'praise') IS NOT NULL
					ELSE false
				END
			)
			FROM jsonb_array_elements(report) AS elem
		$$
	`.execute(db);
	await db.schema.alterTable('interview_transcription_report').addCheckConstraint(
			'llm_report_parsed_valid',
			sql`validate_llm_report_parsed(llm_report_parsed)`,
		).execute();
}

// `any` is required here since migrations should be frozen in time. alternatively, keep a "snapshot" db interface.
export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.alterTable('interview_transcription_report').dropConstraint('llm_report_parsed_valid').execute();
	await sql`DROP FUNCTION IF EXISTS validate_llm_report_parsed(jsonb)`.execute(db);
	await sql`
		CREATE OR REPLACE FUNCTION validate_llm_report_parsed(report jsonb) RETURNS boolean
		LANGUAGE sql IMMUTABLE STRICT AS $$
			SELECT bool_and(
				(elem->>'hintType') IN ('error', 'note', 'praise')
				AND (elem->>'lineId') IS NOT NULL
				AND (elem->>'topic') IS NOT NULL
				AND CASE elem->>'hintType'
					WHEN 'error' THEN
						(elem->>'errorType') IN ('blunder', 'inaccuracy')
						AND (elem->>'whyBad') IS NOT NULL
						AND (elem->>'howToFix') IS NOT NULL
					WHEN 'note' THEN
						(elem->>'note') IS NOT NULL
					WHEN 'praise' THEN
						(elem->>'praise') IS NOT NULL
					ELSE false
				END
			)
			FROM jsonb_array_elements(report) AS elem
		$$
	`.execute(db);

	await db.schema.alterTable('interview_transcription_report').addCheckConstraint(
			'llm_report_parsed_valid',
			sql`validate_llm_report_parsed(llm_report_parsed)`,
		).execute();
}
