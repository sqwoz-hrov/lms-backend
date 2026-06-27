import { Injectable, Inject, NotFoundException, HttpException, HttpStatus } from "@nestjs/common";
import { Kysely, sql } from "kysely";
import { DatabaseProvider } from "../infra/db/db.provider";
import { NewGift, Gift, GiftAggregation, GiftWithUser, GiftWithSubscriptionTier, GiftWithSubscriptionTierAggregated, GiftState } from "./gift.entity";
import { DELETED_USER_FIELD_FALLBACK, User } from "../user/user.entity";
import { Paginated } from "../common/kysely-types/paginated";
import { SubscriptionTransaction } from "../subscription/subscription.repository";

@Injectable()
export class GiftRepository {
    private readonly connection: Kysely<GiftAggregation>;

    constructor(@Inject(DatabaseProvider) dbProvider: DatabaseProvider) {
        this.connection = dbProvider.getDatabase<GiftAggregation>();
    }

    private static mapGiftWithSubscriptionAggregatedToGiftWithSubscriptionTier(agg: GiftWithSubscriptionTierAggregated): GiftWithSubscriptionTier {
        return {
            id: agg.gift__id,
            gifted_to: agg.gift__gifted_to,
            gifted_by: agg.gift__gifted_by,
            tier_id: agg.gift__tier_id,
            activated_at: agg.gift__activated_at,
            duration_days: agg.gift__duration_days,
            tier: {
                id: agg.tier__id,
                tier: agg.tier__tier,
                power: agg.tier__power,
                permissions: agg.tier__permissions,
                price_rubles: agg.tier__price_rubles,
            }
        }
    }

    async create(data: NewGift): Promise<Gift> {
        return await this.connection
            .insertInto('gift')
            .values({ ...data })
            .returningAll()
            .executeTakeFirstOrThrow();
    }

    async resetGift(giftId: Gift['id'], updatedFields: GiftState, trx?: SubscriptionTransaction) {
        if (trx) {
            return await trx.updateTable('gift').where('id', '=', giftId).set(updatedFields).executeTakeFirstOrThrow();
        }

        return await this.connection.updateTable('gift').where('id', '=', giftId).set(updatedFields).executeTakeFirstOrThrow();
    }



    async findGiftedToUser(userId: Pick<User, 'id'>, filter: Partial<Pick<Gift, 'tier_id'> & (Pick<User, 'id'>)> = {}): Promise<Paginated<GiftWithUser>> {
        let query = this.connection.selectFrom('gift').leftJoin('user as gifted_by_user', 'gift.gifted_by', 'gifted_by_user.id').where('gift.gifted_to', '=', userId.id).selectAll('gift').select(['gifted_by_user.telegram_username as telegram_username', 'gifted_by_user.email as email', 'gifted_by_user.name as name']);
        const { tier_id: tierId, id: giftedBy } = filter;

        if (giftedBy) {
            query = query.where('gifted_by_user.id', '=', giftedBy);
        }

        if (tierId) {
            query = query.where('gift.tier_id', '=', tierId);
        }

        const res = await query.execute();
        return { items: res.map(row => ({ ...row, telegram_username: row.telegram_username ?? DELETED_USER_FIELD_FALLBACK, email: row.email ?? DELETED_USER_FIELD_FALLBACK, name: row.name ?? DELETED_USER_FIELD_FALLBACK })) };
    }


    async findGiftedByUser(userId: Pick<User, 'id'>, filter: Partial<Pick<Gift, 'tier_id'> & (Pick<User, 'telegram_username' | 'email'>)> = {}): Promise<Paginated<GiftWithUser>> {
        let query = this.connection.selectFrom('gift').leftJoin('user as gifted_to_user', 'gift.gifted_to', 'gifted_to_user.id').where('gift.gifted_by', '=', userId.id).selectAll('gift').select(['gifted_to_user.telegram_username as telegram_username', 'gifted_to_user.email as email', 'gifted_to_user.name as name']);
        const { tier_id: tierId, telegram_username: telegramUsername, email } = filter;

        if (telegramUsername) {
            query = query.where(eb => eb('gifted_to_user.telegram_username', 'like', `${telegramUsername}%`));
        }

        if (email) {
            query = query.where(eb => eb('gifted_to_user.email', 'like', `${email}%`));
        }

        if (tierId) {
            query = query.where('gift.tier_id', '=', tierId);
        }

        const res = await query.execute();
        return { items: res.map(row => ({ ...row, telegram_username: row.telegram_username ?? DELETED_USER_FIELD_FALLBACK, email: row.email ?? DELETED_USER_FIELD_FALLBACK, name: row.name ?? DELETED_USER_FIELD_FALLBACK })) };
    }

    async findById(id: string): Promise<GiftWithSubscriptionTier | null> {
        const res = await this.connection
            .selectFrom('gift as g')
            .innerJoin('subscription_tier as st', 'g.tier_id', 'st.id')
            .select([
                'g.id as gift__id',
                'g.gifted_to as gift__gifted_to',
                'g.gifted_by as gift__gifted_by',
                'g.tier_id as gift__tier_id',
                'g.activated_at as gift__activated_at',
                'g.duration_days as gift__duration_days',
                'st.id as tier__id',
                'st.tier as tier__tier',
                'st.power as tier__power',
                'st.permissions as tier__permissions',
                'st.price_rubles as tier__price_rubles',
            ])
            .where('g.id', '=', id)
            .limit(1)
            .executeTakeFirst();
        return res ? GiftRepository.mapGiftWithSubscriptionAggregatedToGiftWithSubscriptionTier(res) : null;
    }

    async activateGift(userId: string, id: string): Promise<Gift> {
        return await this.connection.transaction().execute(async trx => {
            const currentGiftState = await trx.selectFrom('gift').selectAll().where('id', '=', id).limit(1).forUpdate().executeTakeFirst();
            if (!currentGiftState || currentGiftState.gifted_to !== userId) {
                throw new NotFoundException('Gift not found');
            }

            if (currentGiftState.activated_at) {
                throw new HttpException('Gift already activated', HttpStatus.CONFLICT);
            }

            await trx.updateTable('subscription').set({ current_period_end: sql`current_period_end + ${currentGiftState.duration_days} * interval '1 day'` }).where('user_id', '=', userId).execute();

            const now = new Date();

            return await trx
                .updateTable('gift')
                // todo: is this test-induced design damage?
                .set({ activated_at: sql<string>`${now.toUTCString()}::timestamptz` })
                .where('id', '=', id)
                .where('gifted_to', '=', userId)
                .where('activated_at', 'is', null)
                .returningAll()
                .executeTakeFirstOrThrow();
        });

    }
}
