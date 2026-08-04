import { Injectable, NotFoundException } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { PostRepository } from '../../post.repository';

@Injectable()
export class OpenPostForTiersUsecase implements UsecaseInterface {
	constructor(private readonly postRepository: PostRepository) {}

	async execute({ postId, minimalTierId }: { postId: string; minimalTierId: string }): Promise<void> {
		const post = await this.postRepository.findById(postId);

		if (!post) {
			throw new NotFoundException('Пост не найден');
		}

		await this.postRepository.setMinimumTier(postId, minimalTierId);
	}
}
