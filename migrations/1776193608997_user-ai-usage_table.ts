import { sql, type Kysely } from 'kysely';
import { LIMITABLE_RESOURCES } from '../src/limits/core/limits.domain';

const USER_AI_USAGE_FEATURES = ['interview_transcription'] as const satisfies typeof LIMITABLE_RESOURCES[number][];

// `any` is required here since migrations should be frozen in time. alternatively, keep a "snapshot" db interface.
export async function up(db: Kysely<any>): Promise<void> {
	await sql`
		CREATE TYPE user_ai_usage_feature AS ENUM (${sql.join(
			USER_AI_USAGE_FEATURES.map(feature => sql.literal(feature)),
			sql`, `,
		)});
	`.execute(db);

	await db.schema
		.createTable('user_ai_usage')
		.addColumn('id', 'uuid', col => col.primaryKey().defaultTo(sql`uuid_generate_v7()`))
		.addColumn('user_id', 'uuid', col => col.notNull().references('user.id').onDelete('cascade'))
		.addColumn('created_at', 'timestamptz', col => col.notNull().defaultTo(sql`now()`))
		.addColumn('feature', sql`user_ai_usage_feature`, col =>
			col.notNull().defaultTo(sql`'interview_transcription'::user_ai_usage_feature`),
		)
		.execute();

	await sql`
		CREATE INDEX user_created_at_feature_idx
		ON user_ai_usage (user_id, created_at DESC, feature);
	`.execute(db);
}

// `any` is required here since migrations should be frozen in time. alternatively, keep a "snapshot" db interface.
export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.dropIndex('user_created_at_feature_idx').ifExists().execute();
	await db.schema.dropTable('user_ai_usage').ifExists().execute();
	await db.schema.dropType('user_ai_usage_feature').ifExists().execute();
}

