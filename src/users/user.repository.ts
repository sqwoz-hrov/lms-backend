import { Kysely } from 'kysely';
import { DatabaseProvider } from '../infra/db/db.provider';
import { User, UserAggregation } from './user.entity';
import { Inject } from '@nestjs/common';

export class UserRepository {
	private readonly connection: Kysely<UserAggregation>;

	constructor(@Inject(DatabaseProvider) dbProvider: DatabaseProvider) {
		this.connection = dbProvider.getDatabase<UserAggregation>();
	}

	public async findById(id: string) {
		const user = await this.connection.selectFrom('user').selectAll().where('id', '=', id).executeTakeFirst();

		return user;
	}

	public async findByTelegramUsername(telegramUsername: string): Promise<User | undefined> {
		const user = await this.connection
			.selectFrom('user')
			.selectAll()
			.where('telegram_username', '=', telegramUsername)
			.executeTakeFirst();

		return user;
	}

	public async findByEmail(email: string): Promise<User | undefined> {
		const user = await this.connection.selectFrom('user').selectAll().where('email', '=', email).executeTakeFirst();

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
