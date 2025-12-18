import { Insertable, Selectable, Updateable } from 'kysely';
import { Generated } from '../common/kysely-types/generated';
import { Timestamp } from '../common/kysely-types/timestamp';

export interface PostTable {
	id: Generated<string>;
	title: string;
	markdown_content_id: string;
	video_id: string | null;
	created_at: Generated<Timestamp>;
}

export type Post = Selectable<PostTable>;
export type NewPost = Insertable<PostTable>;
export type PostUpdate = Updateable<PostTable>;

export interface PostTierTable {
	post_id: string;
	tier_id: string;
}

export type PostTier = Selectable<PostTierTable>;
export type NewPostTier = Insertable<PostTierTable>;

export interface PostAggregation {
	post: PostTable;
	post_tier: PostTierTable;
}

export type PostWithContent = Post & {
	markdown_content: string;
};
