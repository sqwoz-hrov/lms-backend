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

		// TODO: this is an absurd code but yeah whatever
		const minimumTierMap = await this.postRepository.findMinimumTiersForPosts([post.id]);
		const minimumTier = minimumTierMap[post.id];

		const base: PostResponseDto = {
			...post,
			video_id: post.video_id ?? undefined,
			markdown_content: post.markdown_content,
			locked_preview: undefined,
			minimal_tier_id: minimumTier?.id,
		};

		if (user.role !== 'subscriber') {
			return base;
		}

		const subscriberTierPower = user.subscription_tier?.power;

		return {
			...base,
			...(this.buildSubscriberView({
				post,
				minimumTierPower: minimumTier?.power,
				subscriberTierPower,
			}) as Record<string, unknown>),
		};
	}

	private buildSubscriberView({
		post,
		minimumTierPower,
		subscriberTierPower,
	}: {
		post: PostWithContent;
		minimumTierPower?: number;
		subscriberTierPower?: number;
	}): Partial<PostResponseDto> {
		const hasVideo = Boolean(post.video_id);
		const isPublic = minimumTierPower === undefined;
		const hasAccess = isPublic || (typeof subscriberTierPower === 'number' && subscriberTierPower >= minimumTierPower);

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
