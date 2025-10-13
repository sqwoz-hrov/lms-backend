import { Kysely } from 'kysely';
import { Inject } from '@nestjs/common';
import { DatabaseProvider } from '../infra/db/db.provider';
import { Material, MaterialAggregation, MaterialUpdate, NewMaterial, MaterialWithContent } from './material.entity';
import { MarkDownContentAggregation } from '../markdown-content/markdown-content.entity';

export class MaterialRepository {
	private readonly connection: Kysely<MaterialAggregation & MarkDownContentAggregation>;

	constructor(@Inject(DatabaseProvider) dbProvider: DatabaseProvider) {
		this.connection = dbProvider.getDatabase<MaterialAggregation & MarkDownContentAggregation>();
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
			subscription_tier_id?: string;
		} = {},
	): Promise<MaterialWithContent[]> {
		let q = this.connection
			.selectFrom('material')
			.leftJoin('markdown_content', 'markdown_content.id', 'material.markdown_content_id')
			.selectAll('material')
			.select(eb => [eb.ref('markdown_content.content_text').as('markdown_content')]);

		if (filter.subscription_tier_id) {
			q = q
				.innerJoin('material_tier', 'material_tier.material_id', 'material.id')
				.where('material_tier.tier_id', '=', filter.subscription_tier_id);
		}

		if (filter.subject_id !== undefined) {
			q = q.where('subject_id', '=', filter.subject_id);
		}

		if (filter.student_user_id !== undefined) {
			const studentId = filter.student_user_id;
			q = q.where(eb => eb.or([eb('student_user_id', '=', studentId), eb('student_user_id', 'is', null)]));
		}

		const isArchived = filter.is_archived ?? false;
		q = q.where('is_archived', '=', isArchived);

		type MaterialRow = Material & { markdown_content: string | null };
		const materials: MaterialRow[] = await q.execute();

		return materials.map(material => ({
			...material,
			markdown_content: material.markdown_content ?? undefined,
		}));
	}

	async openForTiers(materialId: string, tierIds: string[]): Promise<void> {
		if (!tierIds.length) {
			return;
		}

		await this.connection
			.insertInto('material_tier')
			.values(tierIds.map(tierId => ({ material_id: materialId, tier_id: tierId })))
			.onConflict(oc => oc.columns(['material_id', 'tier_id']).doNothing())
			.execute();
	}
}
