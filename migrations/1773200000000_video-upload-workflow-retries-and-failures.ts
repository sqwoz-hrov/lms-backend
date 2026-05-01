import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema
		.alterTable('video')
		.addColumn('workflow_retry_phase', sql`upload_phase`)
		.addColumn('workflow_retry_count', 'integer', col => col.notNull().defaultTo(0))
		.addColumn('workflow_last_error', 'text')
		.addColumn('workflow_last_error_at', 'timestamptz')
		.addColumn('upload_failed_phase', sql`upload_phase`)
		.addColumn('upload_failed_reason', 'text')
		.addColumn('upload_failed_at', 'timestamptz')
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema
		.alterTable('video')
		.dropColumn('workflow_retry_phase')
		.dropColumn('workflow_retry_count')
		.dropColumn('workflow_last_error')
		.dropColumn('workflow_last_error_at')
		.dropColumn('upload_failed_phase')
		.dropColumn('upload_failed_reason')
		.dropColumn('upload_failed_at')
		.execute();
}
