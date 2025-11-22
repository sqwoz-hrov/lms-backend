import { Kysely } from 'kysely';
import { Inject } from '@nestjs/common';
import { DatabaseProvider } from '../infra/db/db.provider';
import { NewSubject, Subject, SubjectAggregation, SubjectUpdate, SubjectWithSubscriptionTiers } from './subject.entity';

type SubjectJoinRow = Subject & {
	subject_tier__tier_id: string | null;
};

export class SubjectRepository {
	private readonly connection: Kysely<SubjectAggregation>;

	constructor(@Inject(DatabaseProvider) dbProvider: DatabaseProvider) {
		this.connection = dbProvider.getDatabase<SubjectAggregation>();
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

	async find(filter: (Partial<Subject> & { subscription_tier_id?: string }) = {}): Promise<SubjectWithSubscriptionTiers[]> {
		const { subscription_tier_id, ...subjectFilters } = filter;

		let query = this.connection
			.selectFrom('subject')
			.leftJoin('subject_tier', 'subject_tier.subject_id', 'subject.id')
			.selectAll('subject')
			.select(['subject_tier.tier_id as subject_tier__tier_id']);

		for (const key in subjectFilters) {
			const value = subjectFilters[key as keyof typeof subjectFilters];
			if (value !== undefined) {
				query = query.where(key as keyof Subject, '=', value);
			}
		}

		if (subscription_tier_id) {
			const tierId = subscription_tier_id;
			query = query.where(eb =>
				eb.exists(
					eb
						.selectFrom('subject_tier')
						.select('subject_tier.subject_id')
						.whereRef('subject_tier.subject_id', '=', 'subject.id')
						.where('subject_tier.tier_id', '=', tierId),
				),
			);
		}

		const rows = (await query.execute()) as SubjectJoinRow[];

		const subjectOrder: string[] = [];
		const subjectsById = new Map<string, SubjectWithSubscriptionTiers>();

		for (const row of rows) {
			const { subject_tier__tier_id, ...subjectFields } = row;

			let subject = subjectsById.get(subjectFields.id);

			if (!subject) {
				subject = {
					...subjectFields,
					subscription_tier_ids: [],
				};
				subjectsById.set(subject.id, subject);
				subjectOrder.push(subject.id);
			}

			if (subject_tier__tier_id !== null) {
				const tierIds = subject.subscription_tier_ids ?? (subject.subscription_tier_ids = []);
				if (!tierIds.includes(subject_tier__tier_id)) {
					tierIds.push(subject_tier__tier_id);
				}
			}
		}

		return subjectOrder.map(id => subjectsById.get(id)!);
	}

	async openForTiers(subjectId: string, tierIds: string[]): Promise<void> {
		await this.connection.deleteFrom('subject_tier').where('subject_id', '=', subjectId).execute();

		if (!tierIds.length) {
			return;
		}

		await this.connection
			.insertInto('subject_tier')
			.values(tierIds.map(tierId => ({ subject_id: subjectId, tier_id: tierId })))
			.onConflict(oc => oc.columns(['subject_id', 'tier_id']).doNothing())
			.execute();
	}
}
