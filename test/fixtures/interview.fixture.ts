import { HrConnection } from '../../src/hr-connection/hr-connection.entity';
import { HrConnectionsTestRepository } from '../../src/hr-connection/test-utils/test.repo';
import { CreateInterviewDto } from '../../src/interview/dto/create-interview.dto';
import { Interview } from '../../src/interview/interview.entity';
import { InterviewsTestRepository } from '../../src/interview/test-utils/test.repo';
import { UsersTestRepository } from '../../src/user/test-utils/test.repo';
import { User } from '../../src/user/user.entity';
import { randomWord } from './common.fixture';
import { createTestHrConnection } from './hr-connection.fixture';

export class InterviewAggregateBuilder {
	constructor(
		private readonly userRespository: UsersTestRepository,
		private readonly hrConnectionRepository: HrConnectionsTestRepository,
		private readonly interviewRepository: InterviewsTestRepository,
	) {}

	async createInterview(overrides: {
		user?: Partial<User>;
		hrConnection?: Partial<HrConnection>;
		interview?: Partial<Interview>;
	}) {
		const hrConnection = await createTestHrConnection(this.userRespository, this.hrConnectionRepository, {
			hrConnection: overrides.hrConnection,
			user: overrides.user,
		});

		return this.interviewRepository.connection
			.insertInto('interview')
			.values({
				name: overrides.interview?.name ?? randomWord(),
				hr_connection_id: hrConnection.id,
				type: overrides.interview?.type ?? 'screening',
			})
			.returningAll()
			.executeTakeFirstOrThrow();
	}
}

export const createTestInterviewDto = (
	hrConnectionId: string,
	overrides: Partial<CreateInterviewDto> = {},
): CreateInterviewDto => {
	return {
		hr_connection_id: hrConnectionId,
		name: randomWord(),
		type: 'technical_interview',
		...overrides,
	};
};
