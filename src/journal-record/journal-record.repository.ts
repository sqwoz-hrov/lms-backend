import { Inject } from '@nestjs/common';
import { Kysely } from 'kysely';
import { DatabaseProvider } from '../infra/db/db.provider';
import {
	JournalRecord,
	NewJournalRecord,
	JournalRecordUpdate,
	JournalRecordAggregation,
} from './journal-record.entity';

export class JournalRecordRepository {
	private readonly connection: Kysely<JournalRecordAggregation>;

	constructor(@Inject(DatabaseProvider) dbProvider: DatabaseProvider) {
		this.connection = dbProvider.getDatabase<JournalRecordAggregation>();
	}

	async save(data: NewJournalRecord): Promise<JournalRecord> {
		return await this.connection
			.insertInto('journal_record')
			.values({ ...data })
			.returningAll()
			.executeTakeFirstOrThrow();
	}

	async findById(id: string): Promise<JournalRecord | undefined> {
		return await this.connection.selectFrom('journal_record').selectAll().where('id', '=', id).executeTakeFirst();
	}

	async find(filter: Partial<JournalRecord> = {}): Promise<JournalRecord[]> {
		let query = this.connection.selectFrom('journal_record').selectAll();
		for (const key in filter) {
			query = query.where(key as keyof typeof filter, '=', filter[key as keyof typeof filter]!);
		}
		return await query.execute();
	}

	async update(id: string, updates: JournalRecordUpdate): Promise<JournalRecord> {
		return await this.connection
			.updateTable('journal_record')
			.set(updates)
			.where('id', '=', id)
			.returningAll()
			.executeTakeFirstOrThrow();
	}

	async delete(id: string): Promise<JournalRecord> {
		return await this.connection
			.deleteFrom('journal_record')
			.where('id', '=', id)
			.returningAll()
			.executeTakeFirstOrThrow();
	}
}
