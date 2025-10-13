import { Kysely } from 'kysely';
import { Inject } from '@nestjs/common';
import { DatabaseProvider } from '../infra/db/db.provider';
import { Material, MaterialAggregation, MaterialUpdate, NewMaterial } from './material.entity';

export class MaterialRepository {
	private readonly connection: Kysely<MaterialAggregation>;

	constructor(@Inject(DatabaseProvider) dbProvider: DatabaseProvider) {
		this.connection = dbProvider.getDatabase<MaterialAggregation>();
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
	): Promise<Material[]> {
		let q = this.connection.selectFrom('material').selectAll();

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

		return q.execute();
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
