import { Inject, Injectable } from '@nestjs/common';
import { Kysely, Transaction, sql } from 'kysely';
import { DatabaseProvider } from '../infra/db/db.provider';
import { UserAiUsage, UserAiUsageAggregation } from './ai-usage.entity';
import { LimitableResource } from './core/limits.domain';

export type LimitsTransaction = Transaction<UserAiUsageAggregation>;

@Injectable()
export class LimitsRepository {
	private readonly db: Kysely<UserAiUsageAggregation>;

	constructor(@Inject(DatabaseProvider) dbProvider: DatabaseProvider) {
		this.db = dbProvider.getDatabase<UserAiUsageAggregation>();
	}

	async transaction<T>(handler: (trx: LimitsTransaction) => Promise<T>): Promise<T> {
		return await this.db.transaction().execute(handler);
	}

	async getUsageStats(
		{
			feature,
			userId,
		}: {
			feature: LimitableResource;
			userId: string;
		},
		trx?: LimitsTransaction,
	): Promise<{ lastHour: number; lastDay: number }> {
		const executor = trx ?? this.db;

		const result = await executor
			.selectFrom('user_ai_usage')
			.select(eb => [
				eb.fn
					.countAll<number>()
					.filterWhere(sql<boolean>`created_at >= now() - interval '1 hour'`)
					.as('lastHour'),
				eb.fn
					.countAll<number>()
					.filterWhere(sql<boolean>`created_at >= now() - interval '1 day'`)
					.as('lastDay'),
			])
			.where('user_id', '=', userId)
			.where('feature', '=', feature)
			.where(sql<boolean>`created_at >= now() - interval '1 day'`)
			.limit(1)
			.executeTakeFirst();

		return {
			lastHour: Number(result?.lastHour ?? 0),
			lastDay: Number(result?.lastDay ?? 0),
		};
	}

	async recordUsage(
		{
			feature,
			userId,
		}: {
			feature: LimitableResource;
			userId: string;
		},
		trx?: LimitsTransaction,
	): Promise<UserAiUsage> {
		const executor = trx ?? this.db;

		return await executor
			.insertInto('user_ai_usage')
			.values({
				user_id: userId,
				feature,
			})
			.returningAll()
			.executeTakeFirstOrThrow();
	}
}
