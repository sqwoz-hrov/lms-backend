import { Kysely, NotNull, sql, Transaction } from 'kysely';
import { DatabaseProvider } from '../infra/db/db.provider';
import { Subscription } from '../subscription/subscription.entity';
import {
	NewUser,
	SubscriptionGift,
	User,
	UserAggregation,
	UserAndSubscriptionEntity,
	UserRole,
	UserSettings,
	UserWithNullableSubscriptionTier,
} from './user.entity';
import { Inject, NotFoundException } from '@nestjs/common';
import { SubscriptionTier } from '../subscription-tier/subscription-tier.entity';
import { PrefixedValuesNullable } from '../common/kysely-types/prefixed-values';


type UserJoinRow = User &
	PrefixedValuesNullable<Subscription, 'subscription__'> &
	PrefixedValuesNullable<{ 'is_gifted': boolean | null }, 'subscription__'> &
	PrefixedValuesNullable<SubscriptionTier, 'subscription_tier__'>;

type FindUsersFilters = {
	roles?: UserRole[];
};

export type UserSubscriptionTransaction = Transaction<UserAndSubscriptionEntity>;

export class UserRepository {
	private readonly connection: Kysely<UserAggregation>;

	constructor(@Inject(DatabaseProvider) dbProvider: DatabaseProvider) {
		this.connection = dbProvider.getDatabase<UserAggregation>();
	}

	async transaction<T>(handler: (trx: UserSubscriptionTransaction) => Promise<T>): Promise<T> {
		// TODO: singluar database type so that transactions will make sense. And then like a
		// connection getter that narrows types down for a given repo. Or go with aggregates
		return await (this.connection as unknown as Kysely<UserAndSubscriptionEntity>).transaction().execute(handler);
	}

	public async findAll(filters: FindUsersFilters = {}): Promise<UserWithNullableSubscriptionTier[]> {
		let query = this.connection.with('current_subscription', qb => qb
            .selectFrom('subscription as s')
            .leftJoinLateral(
				(eb) => eb.selectFrom('gift')
					.selectAll()
            		.where('gift.activated_at', 'is not', null)
            		.$narrowType<{'activated_at': NotNull}>()
					// this abomination checks if gift is active or not. Btw, we could use virtual computed columns from pg 18
					.whereRef('gifted_to', '=', 's.user_id')
            		.where(
                		sql`(gift.activated_at::timestamptz + (gift.duration_days || ' days')::interval)`,
                		'>=',
                		sql`now()::timestamptz`,
            		).limit(1).as('g'),
					(join) => join.onTrue()

			)
            .select([
                sql<boolean>`(g.id IS NOT NULL)`.as('is_gifted'),
                sql<string>`COALESCE(g.tier_id, s.current_tier_id)`.as('tier_id'),
                sql<Date | null>`COALESCE(g.activated_at::timestamptz, NULL)`.as('gift_activated_at'),
                sql<number | null>`COALESCE(g.duration_days::smallint, NULL)`.as('duration_days'),
            ])
			.selectAll('s')
        )
		.selectFrom('current_subscription as cs')
		// this will inaccurate details about price that person will be paying if gift is active but it's not important since we'll not bill that amount
        .innerJoin('subscription_tier as st', 'cs.tier_id', 'st.id')
		.rightJoin('user', 'user.id', 'cs.user_id')
			.selectAll('user')
			.select([
				'cs.id as subscription__id',
				'cs.user_id as subscription__user_id',
				// this overrides tier id from gift if gift is active
				'cs.tier_id as subscription__current_tier_id',
				'cs.next_tier_id as subscription__next_tier_id',
				// price on purchase will be equal to current tier price since we'll add soft deletion
				'cs.price_on_purchase_rubles as subscription__price_on_purchase_rubles',
				'cs.is_gifted as subscription__is_gifted',
				'cs.grace_period_size as subscription__grace_period_size',
				'cs.billing_period_days as subscription__billing_period_days',
				'cs.current_period_end as subscription__current_period_end',
				'cs.last_billing_attempt as subscription__last_billing_attempt',
				'cs.created_at as subscription__created_at',
				'cs.updated_at as subscription__updated_at',
				'st.id as subscription_tier__id',
				'st.tier as subscription_tier__tier',
				'st.power as subscription_tier__power',
				'st.permissions as subscription_tier__permissions',
				'st.price_rubles as subscription_tier__price_rubles',
			])
			.limit(20)

		if (filters.roles?.length) {
			query = query.where('user.role', 'in', filters.roles);
		}

		const rows = await query.execute();

		return rows.map(row => this.mapRow(row));
	}

	public async findById(id: string): Promise<User | undefined> {
		const user = await this.connection.selectFrom('user').selectAll().where('id', '=', id).limit(1).executeTakeFirst();

		return user;
	}

	// TODO: tests :/
	public async findByIdWithSubscriptionTier(id: string): Promise<UserWithNullableSubscriptionTier | undefined> {
		const query = this.connection.with('current_subscription', qb => qb
            .selectFrom('subscription as s')
            .leftJoinLateral(
				(eb) => eb.selectFrom('gift')
					.selectAll()
            		.where('gift.activated_at', 'is not', null)
            		.$narrowType<{'activated_at': NotNull}>()
					// this abomination checks if gift is active or not. Btw, we could use virtual computed columns from pg 18
					.whereRef('gifted_to', '=', 's.user_id')
            		.where(
                		sql`(gift.activated_at::timestamptz + (gift.duration_days || ' days')::interval)`,
                		'>=',
                		sql`now()::timestamptz`,
            		).limit(1).as('g'),
					(join) => join.onTrue()

			)
            .where('s.user_id', '=', id)
            .select([
                sql<boolean>`(g.id IS NOT NULL)`.as('is_gifted'),
                sql<string>`COALESCE(g.tier_id, s.current_tier_id)`.as('tier_id'),
                sql<Date | null>`COALESCE(g.activated_at::timestamptz, NULL)`.as('gift_activated_at'),
                sql<number | null>`COALESCE(g.duration_days::smallint, NULL)`.as('duration_days'),
            ])
			.selectAll('s')
        )
		.selectFrom('current_subscription as cs')
		// this will inaccurate details about price that person will be paying if gift is active but it's not important since we'll not bill that amount
		// TODO: test cases
		      // this join fails for some reason, idk what is up with that. My guess is that filters in CTE are incorrect
        .innerJoin('subscription_tier as st', 'cs.tier_id', 'st.id')
		.rightJoin('user', 'user.id', 'cs.user_id')
			.selectAll('user')
			.select([
				'cs.id as subscription__id',
				'cs.user_id as subscription__user_id',
				// this overrides tier id from gift if gift is active
				'cs.tier_id as subscription__current_tier_id',
				'cs.next_tier_id as subscription__next_tier_id',
				// price on purchase will be equal to current tier price since we'll add soft deletion
				'cs.price_on_purchase_rubles as subscription__price_on_purchase_rubles',
				'cs.is_gifted as subscription__is_gifted',
				'cs.grace_period_size as subscription__grace_period_size',
				'cs.billing_period_days as subscription__billing_period_days',
				'cs.current_period_end as subscription__current_period_end',
				'cs.last_billing_attempt as subscription__last_billing_attempt',
				'cs.created_at as subscription__created_at',
				'cs.updated_at as subscription__updated_at',
				'st.id as subscription_tier__id',
				'st.tier as subscription_tier__tier',
				'st.power as subscription_tier__power',
				'st.permissions as subscription_tier__permissions',
				'st.price_rubles as subscription_tier__price_rubles',
			])
			.where('user.id', '=', id)
			.limit(1);

		const row = await query.executeTakeFirst();

		if (!row) {
			return undefined;
		}

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

	public async updateSettings(userId: string, settings: UserSettings): Promise<UserSettings> {
		const result = await this.connection
			.updateTable('user')
			.set({ settings })
			.where('id', '=', userId)
			.returning('settings')
			.executeTakeFirst();

		if (!result) {
			throw new NotFoundException('User not found');
		}

		return result.settings;
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

	private mapRow(row: UserJoinRow): UserWithNullableSubscriptionTier {
		const {
			subscription__id,
			subscription__user_id,
			subscription__current_tier_id,
			subscription__next_tier_id,
			subscription__price_on_purchase_rubles,
			subscription__is_gifted,
			subscription__grace_period_size,
			subscription__billing_period_days,
			subscription__current_period_end,
			subscription__last_billing_attempt,
			subscription__created_at,
			subscription__updated_at,
			subscription_tier__id,
			subscription_tier__tier,
			subscription_tier__power,
			subscription_tier__permissions,
			subscription_tier__price_rubles,
			...user
		} = row;

		let subscription: (Subscription & SubscriptionGift) | null = null;
		if (
			subscription__id !== null &&
			subscription__user_id !== null &&
			subscription__current_tier_id !== null &&
			subscription__next_tier_id !== null &&
			subscription__price_on_purchase_rubles !== null &&
			subscription__is_gifted !== null &&
			subscription__grace_period_size !== null &&
			subscription__billing_period_days !== null &&
			subscription__created_at !== null &&
			subscription__updated_at !== null
		) {
			subscription = {
				id: subscription__id,
				user_id: subscription__user_id,
				current_tier_id: subscription__current_tier_id,
				next_tier_id: subscription__next_tier_id,
				price_on_purchase_rubles: subscription__price_on_purchase_rubles,
				is_gifted: subscription__is_gifted,
				grace_period_size: subscription__grace_period_size,
				billing_period_days: subscription__billing_period_days,
				current_period_end: subscription__current_period_end,
				last_billing_attempt: subscription__last_billing_attempt ?? null,
				created_at: subscription__created_at,
				updated_at: subscription__updated_at,
			};
		}

		const subscriptionTier: SubscriptionTier | null =
			subscription_tier__id !== null &&
			subscription_tier__tier !== null &&
			subscription_tier__power !== null &&
			subscription_tier__price_rubles !== null
				? {
						id: subscription_tier__id,
						tier: subscription_tier__tier,
						power: subscription_tier__power,
						permissions: subscription_tier__permissions ?? [],
						price_rubles: subscription_tier__price_rubles,
					}
				: null;

		const baseUser: User = user;

		// TODO: somehow move the db constraint into the typings as well
		const result = {
			...baseUser,
			subscription,
			subscription_tier: subscriptionTier,
		} as unknown as UserWithNullableSubscriptionTier;

		return result;
	}
}
