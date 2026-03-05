import { Inject } from '@nestjs/common';
import { Kysely, sql } from 'kysely';
import { DatabaseProvider } from '../infra/db/db.provider';
import { MarkDownContentAggregation } from '../markdown-content/markdown-content.entity';
import { NewPost, Post, PostAggregation, PostUpdate, PostWithContent } from './post.entity';
import { CursorPaginationInput } from '../common/utils/pagination.util';
import { PostCursorPayload } from './utils/post-cursor.util';

type PaginatedPostsParams = {
	pagination?: CursorPaginationInput<PostCursorPayload>;
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

	async findByIdWithContent(id: string): Promise<PostWithContent | undefined> {
		const row = await this.connection
			.selectFrom('post')
			.innerJoin('markdown_content', 'markdown_content.id', 'post.markdown_content_id')
			.selectAll('post')
			.select(eb => [eb.ref('markdown_content.content_text').as('markdown_content')])
			.where('post.id', '=', id)
			.limit(1)
			.executeTakeFirst();

		if (!row) {
			return undefined;
		}

		const { markdown_content, ...post } = row;

		return {
			...post,
			markdown_content: markdown_content ?? '',
		};
	}

	async list(params: PaginatedPostsParams = {}): Promise<PostWithContent[]> {
		const { pagination, subscriptionTierId } = params;
		const limit = Math.min(Math.max(1, pagination?.limit ?? 25), 30);

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
							.where('post_tier.tier_id', '=', subscriptionTierId),
					),
					eb.not(
						eb.exists(
							eb.selectFrom('post_tier').select('post_tier.post_id').whereRef('post_tier.post_id', '=', 'post.id'),
						),
					),
				]),
			);
		}

		if (pagination?.after) {
			query = query.where(
				sql<boolean>`(post.created_at, post.id) > (${pagination.after.created_at}, ${pagination.after.id})`,
			);
		}

		if (pagination?.before) {
			query = query.where(
				sql<boolean>`(post.created_at, post.id) < (${pagination.before.created_at}, ${pagination.before.id})`,
			);
		}

		const rows = await query.orderBy('post.created_at', 'desc').orderBy('post.id', 'desc').limit(limit).execute();

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
			.select(['post_tier.post_id as post_id', 'post_tier.tier_id as tier_id'])
			.where('post_tier.post_id', 'in', Array.from(postIds))
			.execute();

		return rows.reduce<Record<string, string[]>>((acc, row) => {
			if (!acc[row.post_id]) {
				acc[row.post_id] = [];
			}

			acc[row.post_id].push(row.tier_id);
			return acc;
		}, {});
	}

	async openForTiers(postId: string, tierIds: string[]): Promise<void> {
		await this.connection.deleteFrom('post_tier').where('post_id', '=', postId).execute();

		if (!tierIds.length) {
			return;
		}

		await this.connection
			.insertInto('post_tier')
			.values(tierIds.map(subscriptionTierId => ({ post_id: postId, tier_id: subscriptionTierId })))
			.onConflict(oc => oc.columns(['post_id', 'tier_id']).doNothing())
			.execute();
	}
}
