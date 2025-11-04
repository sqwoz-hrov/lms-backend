import { Injectable, NotFoundException } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { MarkdownContentService } from '../../../markdown-content/services/markdown-content.service';
import { PostResponseDto } from '../../dto/base-post.dto';
import { DeletePostDto } from '../../dto/delete-post.dto';
import { PostRepository } from '../../post.repository';

@Injectable()
export class DeletePostUsecase implements UsecaseInterface {
	constructor(
		private readonly postRepository: PostRepository,
		private readonly markdownContentService: MarkdownContentService,
	) {}

	async execute(dto: DeletePostDto): Promise<PostResponseDto> {
		const existing = await this.postRepository.findById(dto.id);

		if (!existing) {
			throw new NotFoundException('Пост не найден');
		}

		const markdown = await this.markdownContentService.getMarkdownContent(existing.markdown_content_id);

		const deleted = await this.postRepository.delete(dto.id);

		await this.markdownContentService.deleteMakdownContent(deleted.markdown_content_id);

		return {
			...deleted,
			video_id: deleted.video_id ?? undefined,
			markdown_content: markdown.content_text,
		};
	}
}
