import { ColumnType } from 'kysely';

/**
 * Helper type for nullable columns.
 * - Selected value can be `T | null`.
 * - Insert/update values can be `T | null | undefined`.
 */
export type Nullable<T> = ColumnType<T | null, T | null | undefined, T | null | undefined>;
