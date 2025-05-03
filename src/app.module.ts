import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { dbConfig, imageStorageConfig, jwtConfig, otpBotConfig, otpConfig, redisConfig } from './config';
import { InfraModule } from './infra/infra.module';
import { MarkdownContentModule } from './markdown-content/markdown-content.module';
import { TaskModule } from './tasks/task.module';
import { TelegramModule } from './telegram/telegram.module';
import { UserModule } from './users/user.module';
import { JournalRecordModule } from './journal-record/journal-record.module';

@Module({
	imports: [
		ConfigModule.forRoot({
			load: [dbConfig, imageStorageConfig, jwtConfig, otpBotConfig, otpConfig, redisConfig],
			isGlobal: true,
		}),
		InfraModule,
		JournalRecordModule,
		MarkdownContentModule.forRoot({ useRealImageStorage: false }),
		TaskModule,
		TelegramModule.forRoot({ useTelegramAPI: true }),
		UserModule,
	],
	controllers: [],
	providers: [],
})
export class AppModule {}
