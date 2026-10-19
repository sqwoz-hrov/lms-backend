import { Kysely } from 'kysely';
import { DatabaseProvider } from '../../infra/db/db.provider';
import { Gift, GiftTable, NewGift } from '../gift.entity';
import { SubscriptionTierTable } from '../../subscription-tier/subscription-tier.entity';
import { SubscriptionTable } from '../../subscription/subscription.entity';

type GiftTestDb = {
	gift: GiftTable;
	subscription: SubscriptionTable;
	subscription_tier: SubscriptionTierTable;
};

export class GiftTestRepository {
	private readonly connection: Kysely<GiftTestDb>;

	constructor(dbProvider: DatabaseProvider) {
		this.connection = dbProvider.getDatabase<GiftTestDb>();
	}

	async clearAll(): Promise<void> {
		await this.connection.deleteFrom('gift').execute();
		await this.connection.deleteFrom('subscription').execute();
		await this.connection.deleteFrom('subscription_tier').execute();
	}

	async getByFields(params: { giftedBy: string; giftedTo: string; tierId: string }): Promise<Gift | undefined> {
		return await this.connection
			.selectFrom('gift')
			.selectAll()
			.where('gifted_by', '=', params.giftedBy)
			.where('gifted_to', '=', params.giftedTo)
			.where('tier_id', '=', params.tierId)
			.limit(1)
			.executeTakeFirst();
	}

	async insertGift(data: NewGift): Promise<Gift> {
		return await this.connection.insertInto('gift').values(data).returningAll().executeTakeFirstOrThrow();
	}
}
