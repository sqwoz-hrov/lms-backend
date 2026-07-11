import { Inject, Injectable } from '@nestjs/common';
import { Kysely, sql } from 'kysely';
import { OffsetPaginationInput, resolveOffsetPagination } from '../common/utils/pagination.util';
import { DatabaseProvider } from '../infra/db/db.provider';
import { PaymentDatabase, PaymentEvent } from './payment.entity';
import { SUPPORTED_EVENTS, YookassaPaymentSucceededWebhook } from '../subscription/types/yookassa-webhook';

const SUCCESSFUL_PAYMENT_EVENT = 'payment.succeeded' satisfies (typeof SUPPORTED_EVENTS)[number];
const PAYMENT_HISTORY_PAGINATION = {
	defaultLimit: 20,
	maxLimit: 100,
};

export type SuccessfulPaymentStoredEvent = Pick<PaymentEvent, 'created_at' | 'event'> & {
	event: YookassaPaymentSucceededWebhook;
};

export type PaginatedPaymentHistory = {
	items: (SuccessfulPaymentStoredEvent & { payment_method: string })[];
	pagination: {
		page: number;
		pageSize: number;
		totalItems: number;
		totalPages: number;
		hasNextPage: boolean;
		hasPreviousPage: boolean;
	};
};

@Injectable()
export class PaymentHistoryRepository {
	private readonly connection: Kysely<PaymentDatabase>;

	constructor(@Inject(DatabaseProvider) dbProvider: DatabaseProvider) {
		this.connection = dbProvider.getDatabase<PaymentDatabase>();
	}

	async findSuccessfulByUserId(
		userId: string,
		pagination: OffsetPaginationInput = {},
	): Promise<PaginatedPaymentHistory> {
		const resolved = resolveOffsetPagination(pagination, PAYMENT_HISTORY_PAGINATION);

		const baseFilter = (builder: Kysely<PaymentDatabase>) =>
			builder
				.selectFrom('payment_event as pt')
				.where('user_id', '=', userId)
				.where(sql<boolean>`pt.event ->> 'event' = ${SUCCESSFUL_PAYMENT_EVENT}`)
				.$narrowType<SuccessfulPaymentStoredEvent>();

		const [countRow, items] = await Promise.all([
			baseFilter(this.connection)
				.select(eb => eb.fn.countAll<number>().as('count'))
				.executeTakeFirstOrThrow(),
			baseFilter(this.connection)
				.select([
					'pt.created_at',
					'pt.event',
					sql<string>`pt.event -> 'object' -> 'payment_method' -> 'card' ->> 'last4'`.as('payment_method'),
				])
				.orderBy('pt.id', 'desc')
				.limit(resolved.limit)
				.offset(resolved.offset)
				.$narrowType<SuccessfulPaymentStoredEvent & { payment_method: string }>()
				.execute(),
		]);

		const totalItems = Number(countRow.count);
		const totalPages = Math.ceil(totalItems / resolved.pageSize);

		return {
			items,
			pagination: {
				page: resolved.page,
				pageSize: resolved.pageSize,
				totalItems,
				totalPages,
				hasNextPage: resolved.offset + resolved.limit < totalItems,
				hasPreviousPage: resolved.page > 1,
			},
		};
	}
}
