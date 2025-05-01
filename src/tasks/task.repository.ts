import { Kysely } from 'kysely';
import { NewTask, Task, TaskAggregation, TaskUpdate } from './task.entity';
import { Inject } from '@nestjs/common';
import { DatabaseProvider } from '../infra/db/db.provider';

export class TaskRepository {
	private readonly connection: Kysely<TaskAggregation>;

	constructor(@Inject(DatabaseProvider) dbProvider: DatabaseProvider) {
		this.connection = dbProvider.getDatabase<TaskAggregation>();
	}

	async save(data: NewTask) {
		const res = await this.connection
			.insertInto('task')
			.values({ ...data })
			.returningAll()
			.executeTakeFirstOrThrow();

		return res;
	}

	async findById(id: string) {
		return await this.connection.selectFrom('task').selectAll().where('id', '=', id).executeTakeFirstOrThrow();
	}

	async find(filter: Partial<Task> = {}) {
		let query = this.connection.selectFrom('task').selectAll();
		for (const key in filter) {
			query = query.where(key as keyof typeof filter, '=', filter[key as keyof typeof filter]!);
		}
		return await query.execute();
	}

	async update(id: string, updates: TaskUpdate) {
		const res = await this.connection
			.updateTable('task')
			.set(updates)
			.where('id', '=', id)
			.returningAll()
			.executeTakeFirstOrThrow();
		return res;
	}

	async delete(id: string) {
		return this.connection.deleteFrom('task').where('id', '=', id).returningAll().executeTakeFirstOrThrow();
	}
}
