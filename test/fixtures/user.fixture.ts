import { Subscription } from '../../src/subscription/subscription.entity';
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
	const { power: overridePower, ...restOverrides } = overrides;
	const tierName = restOverrides.tier ?? `tier-${randomWord()}`;

	const powerResult = await userRepository.connection
		.selectFrom('subscription_tier')
		.select(({ fn }) => fn.max<number>('power').as('maxPower'))
		.limit(1)
		.executeTakeFirst();

	const resolvedPower = overridePower ?? (powerResult?.maxPower ?? -1) + 1;

	return userRepository.connection
		.insertInto('subscription_tier')
		.values({
			tier: tierName,
			permissions: [],
			power: resolvedPower,
			...restOverrides,
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
			finished_registration: true,
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
			finished_registration: true,
			email: createEmail(),
			...overrides,
		})
		.returningAll()
		.executeTakeFirstOrThrow();
};

type SubscriberFixtureOverrides = Partial<User> & {
	subscription_tier_id?: string | null;
	active_until?: Date | null;
	is_billable?: boolean;
};

export const createTestSubscriber = async (
	userRepository: UsersTestRepository,
	overrides: SubscriberFixtureOverrides = {},
): Promise<UserWithSubscriptionTier & { subscription: Subscription; subscription_tier: SubscriptionTier }> => {
	const { subscription_tier_id, active_until, is_billable, is_archived, ...userOverrides } = overrides;

	const billable = is_billable ?? true;

	const subscriptionTier = subscription_tier_id
		? await userRepository.connection
				.selectFrom('subscription_tier')
				.selectAll()
				.where('id', '=', subscription_tier_id)
				.limit(1)
				.executeTakeFirstOrThrow()
		: await createTestSubscriptionTier(userRepository);
	const resolvedTierId = subscriptionTier.id;

	const now = new Date();
	const defaultActiveUntil = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
	const currentPeriodEnd = active_until ?? defaultActiveUntil;

	const user = await userRepository.connection
		.insertInto('user')
		.values({
			role: 'subscriber',
			name: createName(),
			telegram_username: randomWord(),
			telegram_id: randomNumericId(),
			finished_registration: true,
			email: createEmail(),
			is_archived: is_archived ?? false,
			...userOverrides,
		})
		.returningAll()
		.executeTakeFirstOrThrow();

	const subscription = await userRepository.connection
		.insertInto('subscription')
		.values({
			user_id: user.id,
			subscription_tier_id: resolvedTierId,
			status: 'active',
			price_on_purchase_rubles: billable ? 1500 : 0,
			is_gifted: !billable,
			grace_period_size: 3,
			billing_period_days: billable ? 30 : 0,
			current_period_end: billable ? currentPeriodEnd : null,
			last_billing_attempt: null,
		})
		.returningAll()
		.executeTakeFirstOrThrow();

	return {
		...user,
		subscription,
		subscription_tier: subscriptionTier,
	};
};

export type TestSubscriber = Awaited<ReturnType<typeof createTestSubscriber>>;
