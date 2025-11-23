import { Kysely } from 'kysely';
import { Inject } from '@nestjs/common';
import { DatabaseProvider } from '../infra/db/db.provider';
import { Material, MaterialAggregation, MaterialUpdate, NewMaterial, MaterialWithContent } from './material.entity';
import { MarkDownContentAggregation } from '../markdown-content/markdown-content.entity';

type MaterialJoinRow = Material & {
	markdown_content: string | null;
	material_tier__tier_id: string | null;
};

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
			.leftJoin('material_tier', 'material_tier.material_id', 'material.id')
			.selectAll('material')
			.select(eb => [eb.ref('markdown_content.content_text').as('markdown_content')])
			.select(['material_tier.tier_id as material_tier__tier_id']);

		if (filter.subject_id !== undefined) {
			q = q.where('subject_id', '=', filter.subject_id);
		}

		if (filter.student_user_id !== undefined) {
			const studentId = filter.student_user_id;
			q = q.where(eb => eb.or([eb('student_user_id', '=', studentId), eb('student_user_id', 'is', null)]));
		}

		if (filter.subscription_tier_id !== undefined) {
			const tierId = filter.subscription_tier_id;
			q = q.where(eb =>
				eb.exists(
					eb
						.selectFrom('material_tier')
						.select('material_tier.material_id')
						.whereRef('material_tier.material_id', '=', 'material.id')
						.where('material_tier.tier_id', '=', tierId),
				),
			);
		}

		if (filter.is_archived !== undefined) {
			q = q.where('is_archived', '=', filter.is_archived);
		}

		const rows = (await q.execute()) as MaterialJoinRow[];

		const materialOrder: string[] = [];
		const materialsById = new Map<string, MaterialWithContent>();

		for (const row of rows) {
			const { material_tier__tier_id, markdown_content, ...materialFields } = row;

			let material = materialsById.get(materialFields.id);

			if (!material) {
				material = {
					...materialFields,
					markdown_content: markdown_content ?? undefined,
					subscription_tier_ids: [],
				};

				materialsById.set(material.id, material);
				materialOrder.push(material.id);
			}

			if (material_tier__tier_id !== null) {
				const tierIds = material.subscription_tier_ids ?? (material.subscription_tier_ids = []);

				if (!tierIds.includes(material_tier__tier_id)) {
					tierIds.push(material_tier__tier_id);
				}
			}
		}

		return materialOrder.map(id => materialsById.get(id)!);
	}

	async openForTiers(materialId: string, tierIds: string[]): Promise<void> {
		await this.connection.deleteFrom('material_tier').where('material_id', '=', materialId).execute();

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
