import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { dbConfig, imageStorageConfig, jwtConfig, otpBotConfig, otpConfig, redisConfig } from './config';
import { InfraModule } from './infra/infra.module';
import { MarkdownContentModule } from './markdown-content/markdown-content.module';
import { TaskModule } from './tasks/task.module';
import { TelegramModule } from './telegram/telegram.module';
import { UserModule } from './users/user.module';

@Module({
	imports: [
		ConfigModule.forRoot({
			load: [dbConfig, imageStorageConfig, jwtConfig, otpBotConfig, otpConfig, redisConfig],
			isGlobal: true,
		}),
		InfraModule,
		MarkdownContentModule.forRoot({ useRealImageStorage: false }),
		TelegramModule.forRoot({ useTelegramAPI: true }),
		TaskModule,
		UserModule,
	],
	controllers: [],
	providers: [],
})
export class AppModule {}
