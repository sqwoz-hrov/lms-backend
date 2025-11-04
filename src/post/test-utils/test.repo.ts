import { Kysely } from 'kysely';
import { DatabaseProvider } from '../../infra/db/db.provider';
import { PostAggregation } from '../post.entity';
import { MarkDownContentAggregation } from '../../markdown-content/markdown-content.entity';

export class PostsTestRepository {
	private readonly connection: Kysely<PostAggregation & MarkDownContentAggregation>;

	constructor(dbProvider: DatabaseProvider) {
		this.connection = dbProvider.getDatabase<PostAggregation & MarkDownContentAggregation>();
	}

	get db(): Kysely<PostAggregation & MarkDownContentAggregation> {
		return this.connection;
	}

	async clearAll(): Promise<void> {
		const existingPosts = await this.connection.selectFrom('post').select('markdown_content_id').execute();
		const markdownIds = existingPosts.map(row => row.markdown_content_id).filter((id): id is string => !!id);

		await this.connection.deleteFrom('post_tier').execute();
		await this.connection.deleteFrom('post').execute();

		if (markdownIds.length) {
			await this.connection.deleteFrom('markdown_content').where('id', 'in', markdownIds).execute();
		}
	}
}
