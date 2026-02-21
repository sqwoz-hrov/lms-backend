import { Kysely, sql } from 'kysely'

// `any` is required here since migrations should be frozen in time. alternatively, keep a "snapshot" db interface.
export async function up(db: Kysely<any>): Promise<void> {
	await db.schema
		.createType('llm_hint_type')
		.asEnum(['error', 'note', 'praise'])
		.execute();

	await db.schema
		.createType('llm_error_type')
		.asEnum(['blunder', 'inaccuracy'])
		.execute();

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

	await db.schema
		.createTable('interview_transcription_report')
		.addColumn('id', 'uuid', col => col.primaryKey().defaultTo(sql`uuid_generate_v7()`))
		.addColumn('interview_transcription_id', 'uuid', col =>
			col.notNull().references('interview_transcription.id').onDelete('cascade'),
		)
		.addColumn('llm_report_parsed', 'jsonb', col => col.notNull())
		.addColumn('candidate_name_in_transcription', 'text', col => col.notNull())
		.addColumn('candidate_name', 'text', col => col.notNull())
		.addCheckConstraint(
			'llm_report_parsed_is_array',
			sql`jsonb_typeof(llm_report_parsed) = 'array'`,
		)
		.addCheckConstraint(
			'llm_report_parsed_valid',
			sql`validate_llm_report_parsed(llm_report_parsed)`,
		)
		.execute();

	await db.schema
		.createIndex('interview_transcription_report_transcription_id_idx')
		.on('interview_transcription_report')
		.column('interview_transcription_id')
		.execute();
}

// `any` is required here since migrations should be frozen in time. alternatively, keep a "snapshot" db interface.
export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.dropIndex('interview_transcription_report_transcription_id_idx').execute();
	await db.schema.dropTable('interview_transcription_report').execute();
	await sql`DROP FUNCTION IF EXISTS validate_llm_report_parsed(jsonb)`.execute(db);
	await db.schema.dropType('llm_error_type').execute();
	await db.schema.dropType('llm_hint_type').execute();
}
