import type { Kysely } from 'kysely';
import { sql, type SqlBool } from 'kysely';

const PAYMENT_EVENT_OBJECT_UNIQUE_INDEX_NAME = 'payment_event_yookassa_event_object_id_unique_idx';
const YOOKASSA_WEBHOOK_DEDUPE_INDEX_TARGET = sql`
	((event ->> 'event')),
	(((event -> 'object') ->> 'id'))
`;
const SUPPORTED_YOOKASSA_EVENT_PREDICATE = sql<SqlBool>`
	event ? 'event'
	AND event ? 'object'
	AND (event -> 'object') ? 'id'
	AND
	(event ->> 'event') IN ('payment.succeeded', 'payment.canceled', 'payment_method.active')
	AND (event -> 'object' ->> 'id') IS NOT NULL
`;

// `any` is required here since migrations should be frozen in time. alternatively, keep a "snapshot" db interface.
export async function up(db: Kysely<any>): Promise<void> {
	await sql`
		CREATE UNIQUE INDEX ${sql.id(PAYMENT_EVENT_OBJECT_UNIQUE_INDEX_NAME)}
		ON payment_event (${YOOKASSA_WEBHOOK_DEDUPE_INDEX_TARGET})
		WHERE ${SUPPORTED_YOOKASSA_EVENT_PREDICATE};
	`.execute(db);
}

// `any` is required here since migrations should be frozen in time. alternatively, keep a "snapshot" db interface.
export async function down(db: Kysely<any>): Promise<void> {
	await sql`
		DROP INDEX ${sql.id(PAYMENT_EVENT_OBJECT_UNIQUE_INDEX_NAME)};
	`.execute(db);
}
