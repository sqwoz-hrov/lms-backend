import { Inject } from '@nestjs/common';
import { Kysely } from 'kysely';
import { DatabaseProvider } from '../infra/db/db.provider';
import { MarkDownContentAggregation } from '../markdown-content/markdown-content.entity';
import { NewPost, Post, PostAggregation, PostUpdate, PostWithContent } from './post.entity';
import { applyCursorPagination, CursorPaginationInput } from '../common/utils/pagination.util';

type PaginatedPostsParams = {
	pagination?: CursorPaginationInput<Date>;
	subscriptionTierId?: string;
};

export class PostRepository {
	private readonly connection: Kysely<PostAggregation & MarkDownContentAggregation>;

	constructor(@Inject(DatabaseProvider) dbProvider: DatabaseProvider) {
		this.connection = dbProvider.getDatabase<PostAggregation & MarkDownContentAggregation>();
	}

	async save(data: NewPost): Promise<Post> {
		return await this.connection
			.insertInto('post')
			.values({ ...data })
			.returningAll()
			.executeTakeFirstOrThrow();
	}

	async update(id: string, updates: PostUpdate): Promise<Post> {
		return await this.connection
			.updateTable('post')
			.set(updates)
			.where('id', '=', id)
			.returningAll()
			.executeTakeFirstOrThrow();
	}

	async delete(id: string): Promise<Post> {
		return await this.connection.deleteFrom('post').where('id', '=', id).returningAll().executeTakeFirstOrThrow();
	}

	async findById(id: string): Promise<Post | undefined> {
		return await this.connection.selectFrom('post').selectAll().where('id', '=', id).limit(1).executeTakeFirst();
	}

	async list(params: PaginatedPostsParams = {}): Promise<PostWithContent[]> {
		const { pagination, subscriptionTierId } = params;

		let query = this.connection
			.selectFrom('post')
			.innerJoin('markdown_content', 'markdown_content.id', 'post.markdown_content_id')
			.selectAll('post')
			.select(eb => [eb.ref('markdown_content.content_text').as('markdown_content')]);

		if (subscriptionTierId) {
			query = query.where(eb =>
				eb.or([
					eb.exists(
						eb
							.selectFrom('post_tier')
							.select('post_tier.post_id')
							.whereRef('post_tier.post_id', '=', 'post.id')
							.where('post_tier.subscription_tier_id', '=', subscriptionTierId),
					),
					eb.not(
						eb.exists(
							eb.selectFrom('post_tier').select('post_tier.post_id').whereRef('post_tier.post_id', '=', 'post.id'),
						),
					),
				]),
			);
		}

		type PostRow = Post & { markdown_content: string | null };

		const rows = (await applyCursorPagination(query, pagination ?? {}, {
			cursor: 'post.created_at',
			orderBy: 'post.created_at',
			sortDirection: 'desc',
			defaultLimit: 25,
			maxLimit: 100,
		})
			.orderBy('post.id', 'desc')
			.execute()) as PostRow[];

		return rows.map(row => ({
			...row,
			markdown_content: row.markdown_content ?? '',
		}));
	}

	async findTierIdsForPosts(postIds: readonly string[]): Promise<Record<string, string[]>> {
		if (postIds.length === 0) {
			return {};
		}

		const rows = await this.connection
			.selectFrom('post_tier')
			.select(['post_tier.post_id as post_id', 'post_tier.subscription_tier_id as subscription_tier_id'])
			.where('post_tier.post_id', 'in', Array.from(postIds))
			.execute();

		return rows.reduce<Record<string, string[]>>((acc, row) => {
			if (!acc[row.post_id]) {
				acc[row.post_id] = [];
			}

			acc[row.post_id].push(row.subscription_tier_id);
			return acc;
		}, {});
	}
}
