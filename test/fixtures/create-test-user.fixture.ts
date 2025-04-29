import { UsersTestRepository } from '../../src/users/test-utils/test.repo';
import { User } from '../../src/users/user.entity';

export const createTestUser = async (
	userRepository: UsersTestRepository,
	overrides: Partial<User> = {},
): Promise<User> => {
	const insertRes = await userRepository.connection
		.insertInto('user')
		.returningAll()
		.values({
			role: 'user',
			name: 'testuser',
			telegram_username: 'testuser',
			telegram_id: 123456789,
			email: 'john@doe.com',
			...overrides,
		})
		.execute();
	const user = insertRes.at(0);
	if (!user) {
		throw new Error('User not found');
	}
	return user;
};
