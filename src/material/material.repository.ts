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
		return await this.connection.selectFrom('material').selectAll().where('id', '=', id).executeTakeFirst();
	}

	async find(filter: Partial<Material> = {}): Promise<Material[]> {
		let query = this.connection.selectFrom('material').selectAll();
		for (const key in filter) {
			query = query.where(key as keyof typeof filter, '=', filter[key as keyof typeof filter]!);
		}
		return await query.execute();
	}
}
