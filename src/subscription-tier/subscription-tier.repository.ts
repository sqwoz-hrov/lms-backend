import { Inject, Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { DatabaseProvider } from '../infra/db/db.provider';
import {
	NewSubscriptionTier,
	SubscriptionTier,
	SubscriptionTierTable,
	SubscriptionTierUpdate,
} from '../user/user.entity';

type SubscriptionTierDb = {
	subscription_tier: SubscriptionTierTable;
};

@Injectable()
export class SubscriptionTierRepository {
	private readonly db: Kysely<SubscriptionTierDb>;

	constructor(@Inject(DatabaseProvider) dbProvider: DatabaseProvider) {
		this.db = dbProvider.getDatabase<SubscriptionTierDb>();
	}

	async findAll(): Promise<SubscriptionTier[]> {
		return await this.db.selectFrom('subscription_tier').selectAll().execute();
	}

	async findById(id: string): Promise<SubscriptionTier | undefined> {
		return await this.db.selectFrom('subscription_tier').selectAll().where('id', '=', id).limit(1).executeTakeFirst();
	}

	async create(data: NewSubscriptionTier): Promise<SubscriptionTier> {
		return await this.db.insertInto('subscription_tier').values(data).returningAll().executeTakeFirstOrThrow();
	}

	async update(id: string, updates: SubscriptionTierUpdate): Promise<SubscriptionTier> {
		return await this.db
			.updateTable('subscription_tier')
			.set(updates)
			.where('id', '=', id)
			.returningAll()
			.executeTakeFirstOrThrow();
	}

	async delete(id: string): Promise<SubscriptionTier> {
		return await this.db.deleteFrom('subscription_tier').where('id', '=', id).returningAll().executeTakeFirstOrThrow();
	}
}
