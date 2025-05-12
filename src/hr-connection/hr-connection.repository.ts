import { Inject, Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { DatabaseProvider } from '../infra/db/db.provider';
import { HrConnection, NewHrConnection, HrConnectionUpdate, HrConnectionAggregation } from './hr-connection.entity';

@Injectable()
export class HrConnectionRepository {
	private readonly connection: Kysely<HrConnectionAggregation>;

	constructor(@Inject(DatabaseProvider) dbProvider: DatabaseProvider) {
		this.connection = dbProvider.getDatabase<HrConnectionAggregation>();
	}

	async save(data: NewHrConnection): Promise<HrConnection> {
		return await this.connection
			.insertInto('hr_connection')
			.values({ ...data })
			.returningAll()
			.executeTakeFirstOrThrow();
	}

	async findById(id: string): Promise<HrConnection | undefined> {
		return await this.connection.selectFrom('hr_connection').selectAll().where('id', '=', id).executeTakeFirst();
	}

	async find(filter: Partial<HrConnection> = {}): Promise<HrConnection[]> {
		let query = this.connection.selectFrom('hr_connection').selectAll();
		for (const key in filter) {
			query = query.where(key as keyof typeof filter, '=', filter[key as keyof typeof filter]!);
		}
		return await query.execute();
	}

	async update(id: string, updates: HrConnectionUpdate): Promise<HrConnection> {
		return await this.connection
			.updateTable('hr_connection')
			.set(updates)
			.where('id', '=', id)
			.returningAll()
			.executeTakeFirstOrThrow();
	}

	async delete(id: string): Promise<HrConnection> {
		return await this.connection
			.deleteFrom('hr_connection')
			.where('id', '=', id)
			.returningAll()
			.executeTakeFirstOrThrow();
	}
}
