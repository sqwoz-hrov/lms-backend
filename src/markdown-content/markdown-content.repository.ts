import { Kysely } from 'kysely';
import {
	MarkDownContent,
	MarkDownContentAggregation,
	MarkDownContentUpdate,
	NewMarkDownContent,
} from './markdown-content.entity';
import { DatabaseProvider } from '../infra/db/db.provider';
import { Inject } from '@nestjs/common';

export class MarkdownContentRespository {
	private readonly connection: Kysely<MarkDownContentAggregation>;

	constructor(@Inject(DatabaseProvider) dbProvider: DatabaseProvider) {
		this.connection = dbProvider.getDatabase<MarkDownContentAggregation>();
	}

	public async findById(id: string): Promise<MarkDownContent | undefined> {
		const markdownContent = await this.connection
			.selectFrom('markdown_content')
			.selectAll()
			.where('id', '=', id)
			.executeTakeFirst();

		return markdownContent;
	}

	public async update(id: string, markdownContent: MarkDownContentUpdate): Promise<void> {
		await this.connection.updateTable('markdown_content').set(markdownContent).where('id', '=', id).execute();
	}

	public async save(markdownContent: NewMarkDownContent): Promise<MarkDownContent | undefined> {
		return await this.connection
			.insertInto('markdown_content')
			.values({
				...markdownContent,
			})
			.returningAll()
			.executeTakeFirst();
	}

	public async delete(id: string): Promise<MarkDownContent | undefined> {
		return this.connection.deleteFrom('markdown_content').where('id', '=', id).returningAll().executeTakeFirst();
	}
}
