import { Injectable } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { MarkdownContentService } from '../../../markdown-content/services/markdown-content.service';
import { PostRepository } from '../../post.repository';
import { PostResponseDto } from '../../dto/base-post.dto';
import { CreatePostDto } from '../../dto/create-post.dto';

@Injectable()
export class CreatePostUsecase implements UsecaseInterface {
	constructor(
		private readonly postRepository: PostRepository,
		private readonly markdownContentService: MarkdownContentService,
	) {}

	async execute(dto: CreatePostDto): Promise<PostResponseDto> {
		const { markdown_content, ...postData } = dto;

		const markdown = await this.markdownContentService.uploadMarkdownContent(markdown_content);

		const post = await this.postRepository.save({
			...postData,
			markdown_content_id: markdown.id,
		});

		return {
			...post,
			video_id: post.video_id ?? undefined,
			markdown_content: markdown.content_text,
		};
	}
}
