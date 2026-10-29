import { Kysely } from 'kysely';
import { Inject } from '@nestjs/common';
import { DatabaseProvider } from '../infra/db/db.provider';
import { NewSubject, Subject, SubjectAggregation, SubjectUpdate, SubjectWithSubscriptionTiers } from './subject.entity';
import { SubscriptionTierTable } from '../subscription-tier/subscription-tier.entity';

type SubjectJoinRow = Subject & {
	minimal_tier_id: string | null;
};

type SubjectRepositoryDatabase = SubjectAggregation & {
	subscription_tier: SubscriptionTierTable;
};

export class SubjectRepository {
	private readonly connection: Kysely<SubjectRepositoryDatabase>;

	constructor(@Inject(DatabaseProvider) dbProvider: DatabaseProvider) {
		this.connection = dbProvider.getDatabase<SubjectRepositoryDatabase>();
	}

	async save(data: NewSubject): Promise<Subject> {
		const res = await this.connection
			.insertInto('subject')
			.values({ ...data })
			.returningAll()
			.executeTakeFirstOrThrow();

		return res;
	}

	async update(id: string, updates: SubjectUpdate): Promise<Subject> {
		const res = await this.connection
			.updateTable('subject')
			.set(updates)
			.where('id', '=', id)
			.returningAll()
			.executeTakeFirstOrThrow();

		return res;
	}

	async findById(id: string) {
		return await this.connection.selectFrom('subject').selectAll().where('id', '=', id).limit(1).executeTakeFirst();
	}

	async find(filter: Partial<Subject> & { current_tier_power?: number } = {}): Promise<SubjectWithSubscriptionTiers[]> {
		const { current_tier_power, ...subjectFilters } = filter;

		let query = this.connection
			.selectFrom('subject')
			.leftJoinLateral(
				eb =>
					eb
						.selectFrom('subject_tier')
						.innerJoin('subscription_tier', 'subscription_tier.id', 'subject_tier.tier_id')
						.select(['subject_tier.tier_id as tier_id', 'subscription_tier.power as tier_power'])
						.whereRef('subject_tier.subject_id', '=', 'subject.id')
						.orderBy('subscription_tier.power', 'asc')
						.orderBy('subject_tier.tier_id', 'asc')
						.limit(1)
						.as('minimum_tier'),
				join => join.onTrue(),
			)
			.selectAll('subject')
			.select(['minimum_tier.tier_id as minimal_tier_id']);

		for (const key in subjectFilters) {
			const value = subjectFilters[key as keyof typeof subjectFilters];
			if (value !== undefined) {
				query = query.where(key as keyof Subject, '=', value);
			}
		}

		if (current_tier_power !== undefined) {
			query = query.where('minimum_tier.tier_power', '<=', current_tier_power);
		}

		const rows = (await query.execute()) as SubjectJoinRow[];

		return rows.map(({ minimal_tier_id, ...subject }) => ({
			...subject,
			minimal_tier_id: minimal_tier_id ?? undefined,
		}));
	}

	async setMinimumTier(subjectId: string, minimalTierId: string): Promise<void> {
		await this.connection.deleteFrom('subject_tier').where('subject_id', '=', subjectId).execute();

		await this.connection
			.insertInto('subject_tier')
			.values({ subject_id: subjectId, tier_id: minimalTierId })
			.onConflict(oc => oc.columns(['subject_id', 'tier_id']).doNothing())
			.execute();
	}
}
