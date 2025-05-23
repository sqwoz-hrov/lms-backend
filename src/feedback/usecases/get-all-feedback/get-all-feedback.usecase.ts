import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { GetAllFeedbackDto } from '../../dto/get-all-feedback.dto';
import { BaseFeedbackDto } from '../../dto/base-feedback.dto';
import { User } from '../../../user/user.entity';
import { FeedbackRepository } from '../../feedback.repository';
import { InterviewRepository } from '../../../interview/interview.repository';
import { HrConnectionRepository } from '../../../hr-connection/hr-connection.repository';
import { MarkdownContentService } from '../../../markdown-content/services/markdown-content.service';

@Injectable()
export class GetAllFeedbackUsecase implements UsecaseInterface {
	constructor(
		private readonly feedbackRepository: FeedbackRepository,
		private readonly interviewRespository: InterviewRepository,
		private readonly hrConnectionRespository: HrConnectionRepository,
		private readonly markdownContentService: MarkdownContentService,
	) {}

	async execute({ params, user }: { params: GetAllFeedbackDto; user: User }): Promise<BaseFeedbackDto[]> {
		if (user.role !== 'admin' && params.interview_id) {
			const interview = await this.interviewRespository.findById(params.interview_id);
			if (!interview) {
				throw new NotFoundException('Интервью не найдено');
			}

			const hrConnection = await this.hrConnectionRespository.findById(interview.hr_connection_id);
			if (hrConnection?.student_user_id !== user.id) {
				throw new UnauthorizedException('У вас нет доступа к этому интервью');
			}
		}

		const feedbackRows = await this.feedbackRepository.find(params, user.role === 'admin' ? undefined : user.id);
		const enrichedFeedbackRows = await Promise.all(
			feedbackRows.map(async feedback => {
				const markDownContent = await this.markdownContentService.getMarkdownContent(feedback.markdown_content_id);
				return {
					...feedback,
					markdown_content: markDownContent.content_text,
				};
			}),
		);

		return enrichedFeedbackRows;
	}
}
