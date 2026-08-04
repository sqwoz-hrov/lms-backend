import { Kysely } from 'kysely';
import { Inject } from '@nestjs/common';
import { DatabaseProvider } from '../infra/db/db.provider';
import { Material, MaterialAggregation, MaterialUpdate, NewMaterial, MaterialWithContent } from './material.entity';
import { MarkDownContentAggregation } from '../markdown-content/markdown-content.entity';
import { SubscriptionTierTable } from '../subscription-tier/subscription-tier.entity';

type MaterialJoinRow = Material & {
	markdown_content: string | null;
	minimal_tier_id: string | null;
};

type MaterialRepositoryDatabase = MaterialAggregation &
	MarkDownContentAggregation & {
		subscription_tier: SubscriptionTierTable;
	};

export class MaterialRepository {
	private readonly connection: Kysely<MaterialRepositoryDatabase>;

	constructor(@Inject(DatabaseProvider) dbProvider: DatabaseProvider) {
		this.connection = dbProvider.getDatabase<MaterialRepositoryDatabase>();
	}

	async save(data: NewMaterial): Promise<Material> {
		const res = await this.connection
			.insertInto('material')
			.values({ ...data })
			.returningAll()
			.executeTakeFirstOrThrow();

		return res;
	}

	async update(id: string, updates: MaterialUpdate): Promise<Material> {
		const res = await this.connection
			.updateTable('material')
			.set(updates)
			.where('id', '=', id)
			.returningAll()
			.executeTakeFirstOrThrow();

		return res;
	}

	async findById(id: string): Promise<Material | undefined> {
		return await this.connection.selectFrom('material').selectAll().where('id', '=', id).limit(1).executeTakeFirst();
	}

	async find(
		filter: {
			subject_id?: string;
			student_user_id?: string;
			is_archived?: boolean;
			current_tier_power?: number;
		} = {},
	): Promise<MaterialWithContent[]> {
		let q = this.connection
			.selectFrom('material')
			.leftJoin('markdown_content', 'markdown_content.id', 'material.markdown_content_id')
			.leftJoinLateral(
				eb =>
					eb
						.selectFrom('material_tier')
						.innerJoin('subscription_tier', 'subscription_tier.id', 'material_tier.tier_id')
						.select(['material_tier.tier_id as tier_id', 'subscription_tier.power as tier_power'])
						.whereRef('material_tier.material_id', '=', 'material.id')
						.orderBy('subscription_tier.power', 'asc')
						.orderBy('material_tier.tier_id', 'asc')
						.limit(1)
						.as('minimum_tier'),
				join => join.onTrue(),
			)
			.selectAll('material')
			.select(eb => [eb.ref('markdown_content.content_text').as('markdown_content')])
			.select(['minimum_tier.tier_id as minimal_tier_id']);

		if (filter.subject_id !== undefined) {
			q = q.where('subject_id', '=', filter.subject_id);
		}

		if (filter.student_user_id !== undefined) {
			const studentId = filter.student_user_id;
			q = q.where(eb => eb.or([eb('student_user_id', '=', studentId), eb('student_user_id', 'is', null)]));
		}

		if (filter.current_tier_power !== undefined) {
			q = q.where('minimum_tier.tier_power', '<=', filter.current_tier_power);
		}

		if (filter.is_archived !== undefined) {
			q = q.where('is_archived', '=', filter.is_archived);
		}

		const rows = (await q.execute()) as MaterialJoinRow[];

		return rows.map(({ minimal_tier_id, markdown_content, ...material }) => ({
			...material,
			markdown_content: markdown_content ?? undefined,
			minimal_tier_id: minimal_tier_id ?? undefined,
		}));
	}

	async setMinimumTier(materialId: string, minimalTierId: string): Promise<void> {
		await this.connection.deleteFrom('material_tier').where('material_id', '=', materialId).execute();

		await this.connection
			.insertInto('material_tier')
			.values({ material_id: materialId, tier_id: minimalTierId })
			.onConflict(oc => oc.columns(['material_id', 'tier_id']).doNothing())
			.execute();
	}
}
