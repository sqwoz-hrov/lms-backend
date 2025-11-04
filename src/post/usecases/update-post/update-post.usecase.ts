import { Injectable, NotFoundException } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { MarkdownContentService } from '../../../markdown-content/services/markdown-content.service';
import { PostResponseDto } from '../../dto/base-post.dto';
import { UpdatePostDto } from '../../dto/update-post.dto';
import { PostRepository } from '../../post.repository';

@Injectable()
export class UpdatePostUsecase implements UsecaseInterface {
	constructor(
		private readonly postRepository: PostRepository,
		private readonly markdownContentService: MarkdownContentService,
	) {}

	async execute(dto: UpdatePostDto): Promise<PostResponseDto> {
		const existing = await this.postRepository.findById(dto.id);

		if (!existing) {
			throw new NotFoundException('Пост не найден');
		}

		const { id, markdown_content, ...updates } = dto;

		const markdown = markdown_content
			? await this.markdownContentService.updateMarkdownContent(existing.markdown_content_id, markdown_content)
			: await this.markdownContentService.getMarkdownContent(existing.markdown_content_id);

		const updated = await this.postRepository.update(id, updates);

		return {
			...updated,
			video_id: updated.video_id ?? undefined,
			markdown_content: markdown.content_text,
			locked_preview: undefined,
		};
	}
}
