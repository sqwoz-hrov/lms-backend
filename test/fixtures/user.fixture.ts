import { UsersTestRepository } from '../../src/user/test-utils/test.repo';
import { User } from '../../src/user/user.entity';
import { randomNumericId, randomWord } from './common.fixture';

export const createName = () => {
	const names = ['John', 'Jane', 'Bob', 'Alice', 'Charlie', 'Dave', 'Eve', 'Frank'];
	return names[Math.floor(Math.random() * names.length)];
};

export const createEmail = () => {
	const domains = ['example.com', 'test.com', 'demo.com', 'sample.com'];
	const name = randomWord();
	const domain = domains[Math.floor(Math.random() * domains.length)];
	return `${name}@${domain}`;
};

export const createTestUser = async (
	userRepository: UsersTestRepository,
	overrides: Partial<User> = {},
): Promise<User> => {
	return userRepository.connection
		.insertInto('user')
		.values({
			role: 'user',
			name: createName(),
			telegram_username: randomWord(),
			telegram_id: randomNumericId(),
			email: createEmail(),
			...overrides,
		})
		.returningAll()
		.executeTakeFirstOrThrow();
};

export const createTestAdmin = async (
	userRepository: UsersTestRepository,
	overrides: Partial<User & { role: 'admin' }> = {},
): Promise<User> => {
	return userRepository.connection
		.insertInto('user')
		.values({
			role: 'admin',
			name: createName(),
			telegram_username: randomWord(),
			telegram_id: randomNumericId(),
			email: createEmail(),
			...overrides,
		})
		.returningAll()
		.executeTakeFirstOrThrow();
};
