import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { FeedbackRepository } from '../../feedback.repository';
import { MarkdownContentService } from '../../../markdown-content/services/markdown-content.service';
import { CreateFeedbackDto } from '../../dto/create-feedback.dto';
import { BaseFeedbackDto } from '../../dto/base-feedback.dto';
import { InterviewRepository } from '../../../interview/interview.repository';

@Injectable()
export class CreateFeedbackUsecase implements UsecaseInterface {
	constructor(
		private readonly feedbackRepository: FeedbackRepository,
		private readonly interviewRepository: InterviewRepository,
		@Inject(MarkdownContentService)
		private readonly markdownContentService: MarkdownContentService,
	) {}

	async execute(params: CreateFeedbackDto): Promise<BaseFeedbackDto | undefined> {
		const { interview_id, markdown_content } = params;

		const interview = await this.interviewRepository.findById(interview_id);

		if (!interview) {
			throw new BadRequestException('Интервью не найдено');
		}

		const markdown = await this.markdownContentService.uploadMarkdownContent(markdown_content);

		const saved = await this.feedbackRepository.save({
			interview_id,
			markdown_content_id: markdown.id,
		});

		return {
			...saved,
			markdown_content: markdown.content_text,
		};
	}
}
