import { Inject, Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { DatabaseProvider } from '../infra/db/db.provider';
import {
	JournalRecord,
	NewJournalRecord,
	JournalRecordUpdate,
	JournalRecordAggregation,
	JournalRecordWithContent,
} from './journal-record.entity';
import { MarkDownContentAggregation } from '../markdown-content/markdown-content.entity';

@Injectable()
export class JournalRecordRepository {
	private readonly connection: Kysely<JournalRecordAggregation & MarkDownContentAggregation>;

	constructor(@Inject(DatabaseProvider) dbProvider: DatabaseProvider) {
		this.connection = dbProvider.getDatabase<JournalRecordAggregation & MarkDownContentAggregation>();
	}

	async save(data: NewJournalRecord): Promise<JournalRecord> {
		return await this.connection
			.insertInto('journal_record')
			.values({ ...data })
			.returningAll()
			.executeTakeFirstOrThrow();
	}

	async findById(id: string): Promise<JournalRecord | undefined> {
		return await this.connection
			.selectFrom('journal_record')
			.selectAll()
			.where('id', '=', id)
			.limit(1)
			.executeTakeFirst();
	}

	async find(filter: Partial<JournalRecord> = {}): Promise<JournalRecordWithContent[]> {
		let query = this.connection
			.selectFrom('journal_record')
			.innerJoin('markdown_content', 'markdown_content.id', 'journal_record.markdown_content_id')
			.selectAll('journal_record')
			.select(eb => [eb.ref('markdown_content.content_text').as('markdown_content')]);
		for (const key in filter) {
			if (filter[key as keyof typeof filter] === undefined) continue;
			query = query.where(key as keyof typeof filter, '=', filter[key as keyof typeof filter]!);
		}
		const journalRecords: JournalRecordWithContent[] = await query.execute();

		return journalRecords;
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
