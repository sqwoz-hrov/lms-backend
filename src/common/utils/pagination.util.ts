import { OrderByExpression, ReferenceExpression, SelectQueryBuilder } from 'kysely';

export interface OffsetPaginationInput {
	page?: number;
	pageSize?: number;
	limit?: number;
	offset?: number;
}

export interface PaginationTuning {
	defaultLimit?: number;
	maxLimit?: number;
}

const coerceLimit = (limit: number, fallback: number) => {
	const normalized = Number.isFinite(limit) ? Math.floor(limit) : NaN;
	return normalized > 0 ? normalized : fallback;
};

const resolveLimit = (input: OffsetPaginationInput, tuning?: PaginationTuning) => {
	const defaultLimit = tuning?.defaultLimit ?? 25;
	const maxLimit = tuning?.maxLimit ?? 100;
	const requested = input.limit ?? input.pageSize ?? defaultLimit;
	return Math.min(coerceLimit(requested, defaultLimit), maxLimit);
};

const resolveOffset = (input: OffsetPaginationInput, limit: number) => {
	if (input.offset !== undefined) {
		return Math.max(0, Math.floor(input.offset));
	}

	const rawPage = input.page !== undefined ? Math.floor(input.page) : 1;
	const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;

	return (page - 1) * limit;
};

export const applyOffsetPagination = <DB, TB extends keyof DB, O>(
	query: SelectQueryBuilder<DB, TB, O>,
	input: OffsetPaginationInput = {},
	tuning?: PaginationTuning,
) => {
	const limit = resolveLimit(input, tuning);
	const offset = resolveOffset(input, limit);
	return query.limit(limit).offset(offset);
};

export interface CursorPaginationInput<TCursor = string | number | Date> {
	after?: TCursor;
	before?: TCursor;
	limit?: number;
}

export interface CursorPaginationOptions<DB, TB extends keyof DB, O> extends PaginationTuning {
	cursor: ReferenceExpression<DB, TB>;
	orderBy: OrderByExpression<DB, TB, O>;
	sortDirection?: 'asc' | 'desc';
}

export const applyCursorPagination = <DB, TB extends keyof DB, O, TCursor = string | number | Date>(
	query: SelectQueryBuilder<DB, TB, O>,
	input: CursorPaginationInput<TCursor> = {},
	options: CursorPaginationOptions<DB, TB, O>,
) => {
	const { cursor, orderBy, sortDirection = 'asc', defaultLimit, maxLimit } = options;
	const limit = resolveLimit({ limit: input.limit }, { defaultLimit, maxLimit });

	let builder = query.orderBy(orderBy, sortDirection);

	if (input.after !== undefined) {
		builder = builder.where(cursor, sortDirection === 'asc' ? '>' : '<', input.after as any);
	}

	if (input.before !== undefined) {
		builder = builder.where(cursor, sortDirection === 'asc' ? '<' : '>', input.before as any);
	}

	return builder.limit(limit);
};
