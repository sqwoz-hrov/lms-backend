import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { appConfig, dbConfig, imageStorageConfig, jwtConfig, otpBotConfig, otpConfig, redisConfig } from './config';
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
import { InterviewModule } from './interview/interview.module';
import { FeedbackModule } from './feedback/feedback.module';
import { MetricsModule } from './metrics/metrics.module';

@Module({
	imports: [
		ConfigModule.forRoot({
			load: [
				appConfig,
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
		}),
		FeedbackModule,
		HrConnectionModule,
		ImageModule.forRoot({ useRealStorageAdapters: true }),
		InfraModule,
		InterviewModule,
		JournalRecordModule,
		MarkdownContentModule,
		MaterialModule,
		MetricsModule,
		SubjectModule,
		TaskModule,
		TelegramModule.forRoot({ useTelegramAPI: true }),
		UserModule,
		VideoModule.forRoot({ useRealStorageAdapters: true }),
	],
	controllers: [],
	providers: [],
})
export class AppModule {}
