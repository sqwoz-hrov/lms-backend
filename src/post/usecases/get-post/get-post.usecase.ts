import { Injectable, NotFoundException } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { UserWithSubscriptionTier } from '../../../user/user.entity';
import { PostResponseDto } from '../../dto/base-post.dto';
import { PostRepository } from '../../post.repository';
import { PostWithContent } from '../../post.entity';

@Injectable()
export class GetPostUsecase implements UsecaseInterface {
	constructor(private readonly postRepository: PostRepository) {}

	async execute({ id, user }: { id: string; user: UserWithSubscriptionTier }): Promise<PostResponseDto> {
		const post = await this.postRepository.findByIdWithContent(id);

		if (!post) {
			throw new NotFoundException('Пост не найден');
		}

		const postTierMap = await this.postRepository.findTierIdsForPosts([post.id]);
		const allowedTierIds = postTierMap[post.id] ?? [];

		const base: PostResponseDto = {
			...post,
			video_id: post.video_id ?? undefined,
			markdown_content: post.markdown_content,
			locked_preview: undefined,
			subscription_tier_ids: allowedTierIds,
		};

		if (user.role !== 'subscriber') {
			return base;
		}

		const subscriberTierId = user.subscription?.subscription_tier_id;

		return {
			...base,
			...(this.buildSubscriberView({
				post,
				allowedTierIds,
				subscriberTierId,
			}) as Record<string, unknown>),
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
