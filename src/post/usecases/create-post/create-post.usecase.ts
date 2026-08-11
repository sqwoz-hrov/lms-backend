import { Injectable } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { MarkdownContentService } from '../../../markdown-content/services/markdown-content.service';
import { PostRepository } from '../../post.repository';
import { PostResponseDto } from '../../dto/base-post.dto';
import { CreatePostDto } from '../../dto/create-post.dto';
import { generateValidPostSlug, throwDuplicatePostSlug } from '../../utils/post-slug.util';

@Injectable()
export class CreatePostUsecase implements UsecaseInterface {
	constructor(
		private readonly postRepository: PostRepository,
		private readonly markdownContentService: MarkdownContentService,
	) {}

	async execute(dto: CreatePostDto): Promise<PostResponseDto> {
		const { markdown_content, generate_slug, ...postData } = dto;
		const slug = generate_slug ? generateValidPostSlug(dto.title) : undefined;

		if (slug && (await this.postRepository.findBySlug(slug))) {
			throwDuplicatePostSlug();
		}

		const markdown = await this.markdownContentService.uploadMarkdownContent(markdown_content);

		const post = await this.postRepository
			.save({
				...postData,
				slug: slug ?? null,
				markdown_content_id: markdown.id,
			});

		return {
			...post,
			slug: post.slug ?? undefined,
			video_id: post.video_id ?? undefined,
			markdown_content: markdown.content_text,
			locked_preview: undefined,
		};
	}
}
