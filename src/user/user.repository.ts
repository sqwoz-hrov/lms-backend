import { Kysely } from 'kysely';
import { DatabaseProvider } from '../infra/db/db.provider';
import { Subscription } from '../subscription/subscription.entity';
import { NewUser, SubscriptionTier, User, UserAggregation, UserWithSubscriptionTier } from './user.entity';
import { Inject } from '@nestjs/common';

type PrefixedValues<T, Prefix extends string> = {
	[K in keyof T as `${Prefix}${K & string}`]: T[K];
};

type UserJoinRow = User &
	PrefixedValues<Subscription, 'subscription__'> &
	PrefixedValues<SubscriptionTier, 'subscription_tier__'>;

export class UserRepository {
	private readonly connection: Kysely<UserAggregation>;

	constructor(@Inject(DatabaseProvider) dbProvider: DatabaseProvider) {
		this.connection = dbProvider.getDatabase<UserAggregation>();
	}

	public async findAll(): Promise<UserWithSubscriptionTier[]> {
		const rows = await this.connection
			.selectFrom('user')
			.leftJoin('subscription', 'subscription.user_id', 'user.id')
			.leftJoin('subscription_tier', 'subscription_tier.id', 'subscription.subscription_tier_id')
			.selectAll('user')
			.select([
				'subscription.id as subscription__id',
				'subscription.user_id as subscription__user_id',
				'subscription.subscription_tier_id as subscription__subscription_tier_id',
				'subscription.status as subscription__status',
				'subscription.price_on_purchase_rubles as subscription__price_on_purchase_rubles',
				'subscription.is_gifted as subscription__is_gifted',
				'subscription.grace_period_size as subscription__grace_period_size',
				'subscription.billing_period_days as subscription__billing_period_days',
				'subscription.payment_method_id as subscription__payment_method_id',
				'subscription.current_period_end as subscription__current_period_end',
				'subscription.next_billing_at as subscription__next_billing_at',
				'subscription.billing_retry_attempts as subscription__billing_retry_attempts',
				'subscription.last_billing_attempt as subscription__last_billing_attempt',
				'subscription.created_at as subscription__created_at',
				'subscription.updated_at as subscription__updated_at',
				'subscription_tier.id as subscription_tier__id',
				'subscription_tier.tier as subscription_tier__tier',
				'subscription_tier.permissions as subscription_tier__permissions',
			])
			.execute();

		//@ts-ignore
		return rows.map(row => this.mapRow(row));
	}

	public async findById(id: string): Promise<User | undefined> {
		const user = await this.connection.selectFrom('user').selectAll().where('id', '=', id).limit(1).executeTakeFirst();

		return user;
	}

	public async findByIdWithSubscriptionTier(id: string): Promise<UserWithSubscriptionTier | undefined> {
		const row = await this.connection
			.selectFrom('user')
			.leftJoin('subscription', 'subscription.user_id', 'user.id')
			.leftJoin('subscription_tier', 'subscription_tier.id', 'subscription.subscription_tier_id')
			.selectAll('user')
			.select([
				'subscription.id as subscription__id',
				'subscription.user_id as subscription__user_id',
				'subscription.subscription_tier_id as subscription__subscription_tier_id',
				'subscription.status as subscription__status',
				'subscription.price_on_purchase_rubles as subscription__price_on_purchase_rubles',
				'subscription.is_gifted as subscription__is_gifted',
				'subscription.grace_period_size as subscription__grace_period_size',
				'subscription.billing_period_days as subscription__billing_period_days',
				'subscription.payment_method_id as subscription__payment_method_id',
				'subscription.current_period_end as subscription__current_period_end',
				'subscription.next_billing_at as subscription__next_billing_at',
				'subscription.billing_retry_attempts as subscription__billing_retry_attempts',
				'subscription.last_billing_attempt as subscription__last_billing_attempt',
				'subscription.created_at as subscription__created_at',
				'subscription.updated_at as subscription__updated_at',
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

		//@ts-ignore
		return this.mapRow(row);
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

	public async save(user: Omit<NewUser, 'telegram_id' | 'id'>): Promise<User | undefined> {
		const res = await this.connection
			.insertInto('user')
			.values({
				...user,
			})
			.returningAll()
			.executeTakeFirst();

		return res;
	}

	private mapRow(row: UserJoinRow): UserWithSubscriptionTier {
		const {
			subscription__id,
			subscription__user_id,
			subscription__subscription_tier_id,
			subscription__status,
			subscription__price_on_purchase_rubles,
			subscription__is_gifted,
			subscription__grace_period_size,
			subscription__billing_period_days,
			subscription__payment_method_id,
			subscription__current_period_end,
			subscription__next_billing_at,
			subscription__billing_retry_attempts,
			subscription__last_billing_attempt,
			subscription__created_at,
			subscription__updated_at,
			subscription_tier__id,
			subscription_tier__tier,
			subscription_tier__permissions,
			...user
		} = row;

		const subscription: Subscription | null =
			subscription__id !== null && subscription__user_id !== null
				? {
						id: subscription__id,
						user_id: subscription__user_id,
						subscription_tier_id: subscription__subscription_tier_id,
						status: subscription__status,
						price_on_purchase_rubles: subscription__price_on_purchase_rubles,
						is_gifted: subscription__is_gifted,
						grace_period_size: subscription__grace_period_size,
						billing_period_days: subscription__billing_period_days,
						payment_method_id: subscription__payment_method_id ?? null,
						current_period_end: subscription__current_period_end,
						next_billing_at: subscription__next_billing_at ?? null,
						billing_retry_attempts: subscription__billing_retry_attempts,
						last_billing_attempt: subscription__last_billing_attempt ?? null,
						created_at: subscription__created_at,
						updated_at: subscription__updated_at,
					}
				: null;

		const subscriptionTier: SubscriptionTier | null =
			subscription_tier__id !== null && subscription_tier__tier !== null
				? {
						id: subscription_tier__id,
						tier: subscription_tier__tier,
						permissions: subscription_tier__permissions ?? [],
					}
				: null;

		const baseUser: User = user;

		const result: UserWithSubscriptionTier = {
			...baseUser,
			subscription,
			subscription_tier: subscriptionTier,
		};

		return result;
	}
}
