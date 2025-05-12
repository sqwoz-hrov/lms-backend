import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { dbConfig, imageStorageConfig, jwtConfig, otpBotConfig, otpConfig, redisConfig } from './config';
import { s3Config } from './config/s3.config';
import { youtubeConfig } from './config/youtube.config';
import { ImageModule } from './image/image.module';
import { InfraModule } from './infra/infra.module';
import { JournalRecordModule } from './journal-record/journal-record.module';
import { MarkdownContentModule } from './markdown-content/markdown-content.module';
import { MaterialModule } from './material/material.module';
import { SubjectModule } from './subject/subject.module';
import { TaskModule } from './task/task.module';
import { TelegramModule } from './telegram/telegram.module';
import { UserModule } from './user/user.module';
import { VideoModule } from './video/video.module';
import { HrConnectionModule } from './hr-connection/hr-connection.module';

@Module({
	imports: [
		ConfigModule.forRoot({
			load: [dbConfig, imageStorageConfig, jwtConfig, otpBotConfig, otpConfig, redisConfig, s3Config, youtubeConfig],
			isGlobal: true,
		}),
		HrConnectionModule,
		ImageModule.forRoot({ useRealStorageAdapters: true }),
		VideoModule.forRoot({ useRealStorageAdapters: true }),
		InfraModule,
		JournalRecordModule,
		MarkdownContentModule,
		MaterialModule,
		SubjectModule,
		TaskModule,
		TelegramModule.forRoot({ useTelegramAPI: true }),
		UserModule,
	],
	controllers: [],
	providers: [],
})
export class AppModule {}
