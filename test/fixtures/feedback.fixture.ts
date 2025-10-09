import { CreateFeedbackDto } from '../../src/feedback/dto/create-feedback.dto';
import { Feedback } from '../../src/feedback/feedback.entity';
import { FeedbacksTestRepository } from '../../src/feedback/test-utils/test.repo';
import { HrConnection } from '../../src/hr-connection/hr-connection.entity';
import { HrConnectionsTestRepository } from '../../src/hr-connection/test-utils/test.repo';
import { Interview } from '../../src/interview/interview.entity';
import { InterviewsTestRepository } from '../../src/interview/test-utils/test.repo';
import { MarkDownContent } from '../../src/markdown-content/markdown-content.entity';
import { MarkDownContentTestRepository } from '../../src/markdown-content/test-utils/test.repo';
import { UsersTestRepository } from '../../src/user/test-utils/test.repo';
import { User } from '../../src/user/user.entity';
import { randomWord } from './common.fixture';
import { InterviewAggregateBuilder } from './interview.fixture';
import { createTestMarkdownContent } from './markdown-content.fixture';

export class FeedbackAggregateBuilder {
	private readonly interviewAggregateBuilder: InterviewAggregateBuilder;

	constructor(
		userRepository: UsersTestRepository,
		hrConnectionRepository: HrConnectionsTestRepository,
		interviewRepository: InterviewsTestRepository,
		private readonly feedbackRepository: FeedbacksTestRepository,
		private readonly markdownContentRepository: MarkDownContentTestRepository,
	) {
		this.interviewAggregateBuilder = new InterviewAggregateBuilder(
			userRepository,
			hrConnectionRepository,
			interviewRepository,
		);
	}

	async createFeedback(overrides: {
		user?: Partial<User>;
		hrConnection?: Partial<HrConnection>;
		interview?: Partial<Interview>;
		feedback?: Partial<Feedback>;
		markdownContent?: Partial<MarkDownContent>;
	}) {
		const interview = await this.interviewAggregateBuilder.createInterview({
			user: overrides.user,
			hrConnection: overrides.hrConnection,
			interview: overrides.interview,
		});

		const markdownContent = await createTestMarkdownContent(this.markdownContentRepository, {
			...overrides.markdownContent,
		});

		return this.feedbackRepository.connection
			.insertInto('feedback')
			.values({
				interview_id: interview.id,
				markdown_content_id: markdownContent.id,
				...overrides.feedback,
			})
			.returningAll()
			.executeTakeFirstOrThrow();
	}
}

export const createTestFeedbackDto = (
	interviewId: string,
	overrides: Partial<CreateFeedbackDto> = {},
): CreateFeedbackDto => {
	return {
		interview_id: interviewId,
		markdown_content: randomWord(),
		...overrides,
	};
};
