import { Kysely } from 'kysely';
import { Inject } from '@nestjs/common';
import { DatabaseProvider } from '../infra/db/db.provider';
import { NewSubject, Subject, SubjectAggregation, SubjectUpdate } from './subject.entity';

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
		return await this.connection.selectFrom('subject').selectAll().where('id', '=', id).executeTakeFirst();
	}

	async find(filter: Partial<Subject> = {}): Promise<Subject[]> {
		let query = this.connection.selectFrom('subject').selectAll();
		for (const key in filter) {
			query = query.where(key as keyof typeof filter, '=', filter[key as keyof typeof filter]!);
		}
		return await query.execute();
	}
}
