import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { FeedbackRepository } from '../../feedback.repository';
import { MarkdownContentService } from '../../../markdown-content/services/markdown-content.service';
import { UpdateFeedbackDto } from '../../dto/update-feedback.dto';
import { FeedbackResponseDto } from '../../dto/base-feedback.dto';

@Injectable()
export class EditFeedbackUsecase implements UsecaseInterface {
	constructor(
		private readonly feedbackRepository: FeedbackRepository,
		@Inject(MarkdownContentService)
		private readonly markdownContentService: MarkdownContentService,
	) {}

	async execute(params: UpdateFeedbackDto): Promise<FeedbackResponseDto> {
		const { id, markdown_content, ...updates } = params;

		const existing = await this.feedbackRepository.findById(id);

		if (!existing) {
			throw new NotFoundException('Фидбек не найден');
		}

		const updatedMarkdown = markdown_content
			? await this.markdownContentService.updateMarkdownContent(existing.markdown_content_id, markdown_content)
			: await this.markdownContentService.getMarkdownContent(existing.markdown_content_id);

		const updated = Object.keys(updates).length === 0 ? existing : await this.feedbackRepository.update(id, updates);

		return {
			...updated,
			markdown_content: updatedMarkdown.content_text,
		};
	}
}
