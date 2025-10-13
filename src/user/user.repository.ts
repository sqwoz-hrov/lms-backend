import { Kysely } from 'kysely';
import { DatabaseProvider } from '../infra/db/db.provider';
import { SubscriptionTier, User, UserAggregation, UserWithSubscriptionTier } from './user.entity';
import { Inject } from '@nestjs/common';

export class UserRepository {
	private readonly connection: Kysely<UserAggregation>;

	constructor(@Inject(DatabaseProvider) dbProvider: DatabaseProvider) {
		this.connection = dbProvider.getDatabase<UserAggregation>();
	}

	public async findAll(): Promise<UserWithSubscriptionTier[]> {
		const rows = await this.connection
			.selectFrom('user')
			.leftJoin('subscription_tier', 'subscription_tier.id', 'user.subscription_tier_id')
			.selectAll('user')
			.select([
				'subscription_tier.id as subscription_tier__id',
				'subscription_tier.tier as subscription_tier__tier',
				'subscription_tier.permissions as subscription_tier__permissions',
			])
			.execute();

		return rows.map(row => {
			const { subscription_tier__id, subscription_tier__tier, subscription_tier__permissions, ...user } = row;
			const subscriptionTier: SubscriptionTier | null =
				subscription_tier__id && subscription_tier__tier
					? {
							id: subscription_tier__id,
							tier: subscription_tier__tier,
							permissions: subscription_tier__permissions ?? [],
						}
					: null;

			return {
				...user,
				subscription_tier: subscriptionTier,
			};
		});
	}

	public async findById(id: string): Promise<User | undefined> {
		const user = await this.connection.selectFrom('user').selectAll().where('id', '=', id).limit(1).executeTakeFirst();

		return user;
	}

	public async findByIdWithSubscriptionTier(id: string): Promise<UserWithSubscriptionTier | undefined> {
		const row = await this.connection
			.selectFrom('user')
			.leftJoin('subscription_tier', 'subscription_tier.id', 'user.subscription_tier_id')
			.selectAll('user')
			.select([
				'subscription_tier.id as subscription_tier__id',
				'subscription_tier.tier as subscription_tier__tier',
				'subscription_tier.permissions as subscription_tier__permissions',
			])
			.where('user.id', '=', id)
			.limit(1)
			.executeTakeFirst();

		if (!row) {
			return undefined;
		}

		const { subscription_tier__id, subscription_tier__tier, subscription_tier__permissions, ...user } = row;

		const subscriptionTier: SubscriptionTier | null =
			subscription_tier__id && subscription_tier__tier
				? {
						id: subscription_tier__id,
						tier: subscription_tier__tier,
						permissions: subscription_tier__permissions ?? [],
					}
				: null;

		return {
			...user,
			subscription_tier: subscriptionTier,
		};
	}

	public async findByTelegramUsername(telegramUsername: string): Promise<User | undefined> {
		const user = await this.connection
			.selectFrom('user')
			.selectAll()
			.where('telegram_username', '=', telegramUsername)
			.limit(1)
			.executeTakeFirst();

		return user;
	}

	public async findByEmail(email: string): Promise<User | undefined> {
		const user = await this.connection
			.selectFrom('user')
			.selectAll()
			.where('email', '=', email)
			.limit(1)
			.executeTakeFirst();

		return user;
	}

	public async update(user: User): Promise<void> {
		await this.connection.updateTable('user').set(user).where('id', '=', user.id).execute();
	}

	public async save(user: Omit<User, 'telegram_id' | 'id'>): Promise<User | undefined> {
		const res = await this.connection
			.insertInto('user')
			.values({
				...user,
			})
			.returningAll()
			.executeTakeFirst();

		return res;
	}
}
