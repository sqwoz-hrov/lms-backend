import { Test } from '@nestjs/testing';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';
import { InfraModule } from '../src/infra/infra.module';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { dbConfig, imageStorageConfig, jwtConfig, otpBotConfig, otpConfig, redisConfig } from '../src/config';
import { runMigrations } from './test.run-migrations';
import { SilentLogger } from './test.silent-logger';
import { s3Config } from '../src/config/s3.config';
import { youtubeConfig } from '../src/config/youtube.config';
import { ImageModule } from '../src/image/image.module';
import { INestApplication } from '@nestjs/common';
import { HrConnectionModule } from '../src/hr-connection/hr-connection.module';
import { VideoModule } from '../src/video/video.module';
import { JournalRecordModule } from '../src/journal-record/journal-record.module';
import { MarkdownContentModule } from '../src/markdown-content/markdown-content.module';
import { MaterialModule } from '../src/material/material.module';
import { SubjectModule } from '../src/subject/subject.module';
import { TaskModule } from '../src/task/task.module';
import { TelegramModule } from '../src/telegram/telegram.module';
import { UserModule } from '../src/user/user.module';

export interface ISharedContext extends Mocha.Context {
	app: INestApplication;
	postgresqlContainer: StartedPostgreSqlContainer;
	redisContainer: StartedRedisContainer;
	shutdown: () => Promise<void>;
}

export const mochaHooks = {
	async beforeAll(this: ISharedContext) {
		process.env.REDIS_USERNAME = '';

		const testModule = await Test.createTestingModule({
			imports: [
				ConfigModule.forRoot({
					load: [
						dbConfig,
						imageStorageConfig,
						jwtConfig,
						otpBotConfig,
						otpConfig,
						redisConfig,
						s3Config,
						youtubeConfig,
					],
					isGlobal: true,
					envFilePath: '.env.test',
				}),
				HrConnectionModule,
				ImageModule.forRoot({ useRealStorageAdapters: false }),
				VideoModule.forRoot({ useRealStorageAdapters: false }),
				InfraModule,
				JournalRecordModule,
				MarkdownContentModule,
				MaterialModule,
				SubjectModule,
				TaskModule,
				TelegramModule.forRoot({ useTelegramAPI: false }),
				UserModule,
			],
		}).compile();

		const app = testModule.createNestApplication();
		app.useLogger(new SilentLogger());

		const _dbConfig = app.get<ConfigType<typeof dbConfig>>(dbConfig.KEY);
		const _redisConfig = app.get<ConfigType<typeof redisConfig>>(redisConfig.KEY);

		const postgresqlContainer = await new PostgreSqlContainer()
			.withHostname(_dbConfig.host)
			.withExposedPorts({ container: _dbConfig.port, host: _dbConfig.port })
			.withDatabase(_dbConfig.database)
			.withUsername(_dbConfig.user)
			.withPassword(_dbConfig.password)
			.start();

		const redisContainer = await new RedisContainer()
			.withHostname(_redisConfig.redisHost)
			.withExposedPorts({ container: _redisConfig.redisPort, host: _redisConfig.redisPort })
			.withPassword(_redisConfig.redisPassword)
			.start();

		await runMigrations({ useReal: true, connectionInfo: _dbConfig });

		const shutdown = async () => {
			await app.close();
			await postgresqlContainer.stop();
			await redisContainer.stop();
		};

		await app.init();
		await app.listen(3000);

		// Share in test context
		this.app = app;
		this.postgresqlContainer = postgresqlContainer;
		this.redisContainer = redisContainer;
		this.shutdown = shutdown;
	},

	async afterAll(this: ISharedContext) {
		await this.shutdown?.();
	},
};
