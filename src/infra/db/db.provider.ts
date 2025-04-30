import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { Kysely, Dialect } from 'kysely';
import { dbConfig } from '../../config';
import { DIALECT_FACTORY_KEY } from '../../infra/db/db.const';

@Injectable()
export class DatabaseProvider {
	private readonly database: Kysely<unknown>;

	constructor(
		@Inject(dbConfig.KEY) config: ConfigType<typeof dbConfig>,
		@Inject(DIALECT_FACTORY_KEY)
		dialectFactory: (config: {
			host: string;
			port: number;
			user: string;
			password: string;
			database: string;
			path: string;
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
