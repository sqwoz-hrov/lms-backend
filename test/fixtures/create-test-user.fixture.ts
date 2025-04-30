import { randomBytes } from 'node:crypto';

import { UsersTestRepository } from '../../src/users/test-utils/test.repo';
import { User } from '../../src/users/user.entity';

export const randomWord = () => {
	const buf = randomBytes(4);
	const word = buf.toString('hex');
	return word;
};

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

export const randomId = () => {
	const buf = randomBytes(1);
	const idHex = buf.toString('hex');
	const id = parseInt(idHex, 16);
	return id;
};

export const createTestUser = async (
	userRepository: UsersTestRepository,
	overrides: Partial<User> = {},
): Promise<User> => {
	const insertRes = await userRepository.connection
		.insertInto('user')
		.returningAll()
		.values({
			role: 'user',
			name: createName(),
			telegram_username: randomWord(),
			telegram_id: randomId(),
			email: createEmail(),
			...overrides,
		})
		.execute();
	const user = insertRes.at(0);
	if (!user) {
		throw new Error('User not found');
	}
	return user;
};

export const createTestAdmin = async (
	userRepository: UsersTestRepository,
	overrides: Partial<User & { role: 'admin' }> = {},
): Promise<User> => {
	const insertRes = await userRepository.connection
		.insertInto('user')
		.returningAll()
		.values({
			role: 'admin',
			name: createName(),
			telegram_username: randomWord(),
			telegram_id: randomId(),
			email: createEmail(),
			...overrides,
		})
		.execute();
	const user = insertRes.at(0);
	if (!user) {
		throw new Error('User not found');
	}
	return user;
};
