import { Injectable } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { UserWithSubscriptionTier } from '../../../user/user.entity';
import { PostResponseDto } from '../../dto/base-post.dto';
import { GetPostsDto } from '../../dto/get-posts.dto';
import { PostRepository } from '../../post.repository';
import { PostWithContent } from '../../post.entity';

@Injectable()
export class ListPostsUsecase implements UsecaseInterface {
	constructor(private readonly postRepository: PostRepository) {}

	async execute({ user, params }: { user: UserWithSubscriptionTier; params: GetPostsDto }): Promise<PostResponseDto[]> {
		const { after, before, limit, subscription_tier_id: requestedSubscriptionTierId } = params;

		const pagination = {
			after: after ? new Date(after) : undefined,
			before: before ? new Date(before) : undefined,
			limit,
		};

		const posts = await this.postRepository.list({
			pagination,
			subscriptionTierId: user.role === 'subscriber' ? undefined : requestedSubscriptionTierId,
		});

		const postTierMap = await this.postRepository.findTierIdsForPosts(posts.map(post => post.id));

		const isSubscriber = user.role === 'subscriber';

		if (!isSubscriber) {
			return posts.map(post => ({
				...post,
				video_id: post.video_id ?? undefined,
				locked_preview: undefined,
				subscription_tier_ids: postTierMap[post.id] ?? [],
			}));
		}

		const subscriberTierId = user.subscription?.subscription_tier_id;

		return posts.map(post => {
			const allowedTierIds = postTierMap[post.id] ?? [];

			const base: PostResponseDto = {
				...post,
				video_id: post.video_id ?? undefined,
				locked_preview: undefined,
				subscription_tier_ids: allowedTierIds,
			};

			return {
				...base,
				...(this.buildSubscriberView({
					post,
					allowedTierIds,
					subscriberTierId,
				}) as Record<string, unknown>),
			};
		});
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
