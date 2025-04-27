import { Kysely } from 'kysely';
import { DatabaseProvider } from '../infra/db/db.provider';
import { User, UserAggregation } from './user.entity';

export class UserRepository {
	private readonly connection: Kysely<UserAggregation>;

	constructor(private readonly dbProvider: DatabaseProvider) {
		this.connection = dbProvider.getDatabase<UserAggregation>();
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
}
