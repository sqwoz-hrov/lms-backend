import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { HrConnectionRepository } from '../../../hr-connection/hr-connection.repository';
import { InterviewRepository } from '../../../interview/interview.repository';
import { MarkdownContentService } from '../../../markdown-content/services/markdown-content.service';
import { User } from '../../../user/user.entity';
import { BaseFeedbackDto } from '../../dto/base-feedback.dto';
import { FeedbackRepository } from '../../feedback.repository';

@Injectable()
export class GetFeedbackInfoUsecase implements UsecaseInterface {
	constructor(
		private readonly feedbackRepository: FeedbackRepository,
		private readonly interviewRespository: InterviewRepository,
		private readonly hrConnectionRespository: HrConnectionRepository,
		private readonly markdownContentService: MarkdownContentService,
	) {}

	async execute({ params, user }: { params: { id: string }; user: User }): Promise<BaseFeedbackDto> {
		const feedback = await this.feedbackRepository.findById(params.id);
		if (!feedback) {
			throw new NotFoundException('Фидбек не найден');
		}

		if (user.role !== 'admin') {
			const interview = await this.interviewRespository.findById(feedback.interview_id);
			if (!interview) {
				throw new NotFoundException('Интервью не найдено');
			}

			const hrConnection = await this.hrConnectionRespository.findById(interview.hr_connection_id);
			if (hrConnection?.student_user_id !== user.id) {
				throw new UnauthorizedException('У вас нет доступа к этому интервью');
			}
		}

		const markDownContent = await this.markdownContentService.getMarkdownContent(feedback.markdown_content_id);

		return {
			...feedback,
			markdown_content: markDownContent?.content_text ?? '',
		};
	}
}
