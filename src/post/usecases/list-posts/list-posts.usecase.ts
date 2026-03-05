import { Injectable } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { UserWithSubscriptionTier } from '../../../user/user.entity';
import { PostListResponseDto, PostResponseDto } from '../../dto/base-post.dto';
import { GetPostsDto } from '../../dto/get-posts.dto';
import { PostRepository } from '../../post.repository';
import { PostWithContent } from '../../post.entity';
import { decodePostCursor, encodePostCursor } from '../../utils/post-cursor.util';

@Injectable()
export class ListPostsUsecase implements UsecaseInterface {
	constructor(private readonly postRepository: PostRepository) {}

	async execute({
		user,
		params,
	}: {
		user: UserWithSubscriptionTier;
		params: GetPostsDto;
	}): Promise<PostListResponseDto> {
		const { after, before, limit, subscription_tier_id: requestedSubscriptionTierId } = params;

		const pagination = {
			after: after ? decodePostCursor(after) : undefined,
			before: before ? decodePostCursor(before) : undefined,
			limit,
		};

		const posts = await this.postRepository.list({
			pagination,
			subscriptionTierId: user.role === 'subscriber' ? undefined : requestedSubscriptionTierId,
		});

		const postTierMap = await this.postRepository.findTierIdsForPosts(posts.map(post => post.id));

		const isSubscriber = user.role === 'subscriber';
		const subscriberTierId = user.subscription?.subscription_tier_id;

		const items = posts.map(post => {
			const allowedTierIds = postTierMap[post.id] ?? [];

			const base: PostResponseDto = {
				...post,
				video_id: post.video_id ?? undefined,
				locked_preview: undefined,
				subscription_tier_ids: allowedTierIds,
			};

			if (!isSubscriber) {
				return base;
			}

			return {
				...base,
				...(this.buildSubscriberView({
					post,
					allowedTierIds,
					subscriberTierId,
				}) as Record<string, unknown>),
			};
		});

		const nextCursor = items.length
			? encodePostCursor({
					id: items[items.length - 1].id,
					created_at: new Date(items[items.length - 1].created_at),
				})
			: undefined;

		const prevCursor = items.length
			? encodePostCursor({
					id: items[0].id,
					created_at: new Date(items[0].created_at),
				})
			: undefined;

		return {
			items,
			next_cursor: nextCursor,
			prev_cursor: prevCursor,
		};
	}

	private buildSubscriberView({
		post,
		allowedTierIds,
		subscriberTierId,
	}: {
		post: PostWithContent;
		allowedTierIds: string[];
		subscriberTierId?: string;
	}): Partial<PostResponseDto> {
		const hasVideo = Boolean(post.video_id);
		const isPublic = allowedTierIds.length === 0;
		const hasAccess = isPublic || (!!subscriberTierId && allowedTierIds.includes(subscriberTierId));

		if (hasAccess) {
			return {
				video_id: post.video_id ?? undefined,
				locked_preview: undefined,
			};
		}

		return {
			video_id: undefined,
			markdown_content: undefined,
			locked_preview: {
				has_video: hasVideo,
			},
		};
	}
}
