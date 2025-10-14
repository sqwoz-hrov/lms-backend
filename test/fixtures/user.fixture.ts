import { UsersTestRepository } from '../../src/user/test-utils/test.repo';
import { SubscriptionTier, User, UserWithSubscriptionTier } from '../../src/user/user.entity';
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

export const createTestSubscriptionTier = async (
	userRepository: UsersTestRepository,
	overrides: Partial<SubscriptionTier> = {},
): Promise<SubscriptionTier> => {
	const tierName = overrides.tier ?? `tier-${randomWord()}`;

	return userRepository.connection
		.insertInto('subscription_tier')
		.values({
			tier: tierName,
			permissions: [],
			...overrides,
		})
		.returningAll()
		.executeTakeFirstOrThrow();
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

export const createTestSubscriber = async (
	userRepository: UsersTestRepository,
	overrides: Partial<User> = {},
): Promise<UserWithSubscriptionTier> => {
	const { subscription_tier_id, active_until, is_billable, is_archived, ...restOverrides } = overrides;

	const billable = is_billable ?? true;
	let resolvedTierId = subscription_tier_id ?? null;
	let resolvedActiveUntil = active_until ?? null;

	let subscriptionTier: SubscriptionTier | null = null;
	if (billable) {
		if (!resolvedTierId) {
			subscriptionTier = await createTestSubscriptionTier(userRepository);
			resolvedTierId = subscriptionTier.id;
		}

		if (!resolvedActiveUntil) {
			resolvedActiveUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
		}
	}

	const user = await userRepository.connection
		.insertInto('user')
		.values({
			role: 'subscriber',
			name: createName(),
			telegram_username: randomWord(),
			telegram_id: randomNumericId(),
			email: createEmail(),
			is_billable: billable,
			is_archived: is_archived ?? false,
			subscription_tier_id: resolvedTierId,
			active_until: resolvedActiveUntil,
			...restOverrides,
		})
		.returningAll()
		.executeTakeFirstOrThrow();

	return { ...user, ...{ subscription_tier: subscriptionTier } };
};
