import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { Kysely, Dialect } from 'kysely';
import { dbConfig } from '../../configs/db.config';

@Injectable()
export class DatabaseProvider {
	private readonly database: Kysely<unknown>;

	constructor(
		@Inject(dbConfig.KEY) private readonly config: ConfigType<typeof dbConfig>,
		@Inject()
		private readonly dialectFactory: (config: {
			host: string;
			port: number;
			username: string;
			password: string;
			database: string;
		}) => Dialect,
	) {
		this.database = new Kysely<unknown>({
			dialect: dialectFactory({
				...config,
			}),
		});
	}

	getDatabase<T>(): Kysely<T> {
		return this.database as Kysely<T>;
	}
}
