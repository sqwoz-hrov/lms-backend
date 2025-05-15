import { Inject, Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { DatabaseProvider } from '../infra/db/db.provider';
import { Interview, NewInterview, InterviewUpdate, InterviewAggregation } from './interview.entity';
import { HrConnectionAggregation } from '../hr-connection/hr-connection.entity';

@Injectable()
export class InterviewRepository {
	private readonly connection: Kysely<InterviewAggregation & HrConnectionAggregation>;

	constructor(@Inject(DatabaseProvider) dbProvider: DatabaseProvider) {
		this.connection = dbProvider.getDatabase<InterviewAggregation & HrConnectionAggregation>();
	}

	async save(data: NewInterview): Promise<Interview> {
		return await this.connection
			.insertInto('interview')
			.values({ ...data })
			.returningAll()
			.executeTakeFirstOrThrow();
	}

	async findById(id: string): Promise<Interview | undefined> {
		return await this.connection.selectFrom('interview').selectAll().where('id', '=', id).executeTakeFirst();
	}

	async find(filter: Partial<Interview> = {}, userId?: string): Promise<Interview[]> {
		let query = this.connection
			.selectFrom('interview')
			.innerJoin('hr_connection', 'hr_connection.id', 'interview.hr_connection_id')
			.selectAll('interview');

		if (userId) {
			query = query.where('hr_connection.student_user_id', '=', userId);
		}

		for (const key in filter) {
			query = query.where(`interview.${key}` as keyof typeof filter, '=', filter[key as keyof typeof filter]!);
		}

		return await query.execute();
	}

	async update(id: string, updates: InterviewUpdate): Promise<Interview> {
		return await this.connection
			.updateTable('interview')
			.set(updates)
			.where('id', '=', id)
			.returningAll()
			.executeTakeFirstOrThrow();
	}

	async delete(id: string): Promise<Interview> {
		return await this.connection.deleteFrom('interview').where('id', '=', id).returningAll().executeTakeFirstOrThrow();
	}
}
