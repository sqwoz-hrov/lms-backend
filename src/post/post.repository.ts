import { Inject } from '@nestjs/common';
import { Kysely } from 'kysely';
import { DatabaseProvider } from '../infra/db/db.provider';
import { MarkDownContentAggregation } from '../markdown-content/markdown-content.entity';
import { NewPost, Post, PostAggregation, PostUpdate } from './post.entity';

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
}
