import { INestApplication } from '@nestjs/common';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { StartedMinioContainer } from '@testcontainers/minio';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { StartedRedisContainer } from '@testcontainers/redis';
import * as cookieParser from 'cookie-parser';
import {
	appConfig,
	dbConfig,
	imageStorageConfig,
	jwtConfig,
	otpBotConfig,
	otpConfig,
	redisConfig,
	s3Config,
} from '../../src/config';
import { FeedbackModule } from '../../src/feedback/feedback.module';
import { HrConnectionModule } from '../../src/hr-connection/hr-connection.module';
import { ImageModule } from '../../src/image/image.module';
import { InfraModule } from '../../src/infra/infra.module';
import { InterviewModule } from '../../src/interview/interview.module';
import { JournalRecordModule } from '../../src/journal-record/journal-record.module';
import { MarkdownContentModule } from '../../src/markdown-content/markdown-content.module';
import { MaterialModule } from '../../src/material/material.module';
import { SubjectModule } from '../../src/subject/subject.module';
import { TaskModule } from '../../src/task/task.module';
import { TelegramModule } from '../../src/telegram/telegram.module';
import { UserModule } from '../../src/user/user.module';
import { VideoModule } from '../../src/video/video.module';
import { startAllContainers } from './test.start-all-containers';
import { SilentLogger } from '../test.silent-logger';

export interface ISharedContext extends Mocha.Context {
	app: INestApplication;
	postgresqlContainer: StartedPostgreSqlContainer;
	redisContainer: StartedRedisContainer;
	s3Container: StartedMinioContainer;
	shutdown: () => Promise<void>;
}

export const mochaHooks = {
	async beforeAll(this: ISharedContext) {
		console.time('whole');
		process.env.REDIS_USERNAME = '';
		const NO_SILENT_FLAG = '--no-silent';
		const hasNoSilentFlag = process.argv.includes(NO_SILENT_FLAG) || process.env.npm_config_no_silent === 'true';
		const shouldUseSilentLogger = !hasNoSilentFlag;

		const testModule = await Test.createTestingModule({
			imports: [
				ConfigModule.forRoot({
					load: [appConfig, dbConfig, imageStorageConfig, jwtConfig, otpBotConfig, otpConfig, redisConfig, s3Config],
					isGlobal: true,
					envFilePath: '.env.test',
				}),
				FeedbackModule,
				HrConnectionModule,
				ImageModule.forRoot({ useRealStorageAdapters: false }),
				InfraModule,
				InterviewModule,
				JournalRecordModule,
				MarkdownContentModule,
				MaterialModule,
				SubjectModule,
				TaskModule,
				TelegramModule.forRoot({ useTelegramAPI: false }),
				UserModule,
				VideoModule,
			],
		}).compile();

		const app = testModule.createNestApplication();
		if (shouldUseSilentLogger) {
			app.useLogger(new SilentLogger());
		}
		app.use(cookieParser());

		const _dbConfig = app.get<ConfigType<typeof dbConfig>>(dbConfig.KEY);
		const _redisConfig = app.get<ConfigType<typeof redisConfig>>(redisConfig.KEY);
		const _s3Config = app.get<ConfigType<typeof s3Config>>(s3Config.KEY);

		const { postgresqlContainer, redisContainer, s3Container, stopTestContainers } = await startAllContainers(
			_dbConfig,
			_redisConfig,
			_s3Config,
		);

		const shutdown = async () => {
			await app.close();
			await stopTestContainers();
		};

		await app.init();
		await app.listen(3000);

		// Share in test context
		this.app = app;
		this.postgresqlContainer = postgresqlContainer;
		this.redisContainer = redisContainer;
		this.s3Container = s3Container;
		this.shutdown = shutdown;
		console.timeEnd('whole');
	},

	async afterAll(this: ISharedContext) {
		await this.shutdown?.();
	},
};
