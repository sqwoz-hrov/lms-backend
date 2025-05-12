import { CreateHrConnectionDto } from '../../src/hr-connection/dto/create-hr-connection.dto';
import { HrConnection } from '../../src/hr-connection/hr-connection.entity';
import { HrConnectionsTestRepository } from '../../src/hr-connection/test-utils/test.repo';
import { UsersTestRepository } from '../../src/user/test-utils/test.repo';
import { User } from '../../src/user/user.entity';
import { randomWord } from './common.fixture';
import { createTestUser } from './user.fixture';

export const createTestHrConnectionDto = (
	studentId: string,
	overrides: Partial<CreateHrConnectionDto> = {},
): CreateHrConnectionDto => {
	return {
		student_user_id: studentId,
		name: randomWord(),
		status: 'waiting_us',
		chat_link: `https://chat.example.com/${randomWord()}`,
		...overrides,
	};
};

export const createTestHrConnection = async (
	userRepository: UsersTestRepository,
	hrConnectionRepository: HrConnectionsTestRepository,
	overrides: {
		user?: Partial<User>;
		hrConnection?: Partial<HrConnection>;
	} = {},
): Promise<HrConnection> => {
	const student_user_id =
		overrides.hrConnection?.student_user_id ?? (await createTestUser(userRepository, overrides.user ?? {})).id;

	return await hrConnectionRepository.connection
		.insertInto('hr_connection')
		.values({
			student_user_id,
			name: overrides.hrConnection?.name ?? randomWord(),
			status: overrides.hrConnection?.status ?? 'waiting_us',
			chat_link: overrides.hrConnection?.chat_link ?? `https://chat.example.com/${randomWord()}`,
			...overrides.hrConnection,
		})
		.returningAll()
		.executeTakeFirstOrThrow();
};
