import { Injectable, NotFoundException } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { PostRepository } from '../../post.repository';

@Injectable()
export class OpenPostForTiersUsecase implements UsecaseInterface {
	constructor(private readonly postRepository: PostRepository) {}

	async execute({ postId, tierIds }: { postId: string; tierIds: string[] }): Promise<void> {
		const post = await this.postRepository.findById(postId);

		if (!post) {
			throw new NotFoundException('Пост не найден');
		}

		await this.postRepository.openForTiers(postId, tierIds);
	}
}
