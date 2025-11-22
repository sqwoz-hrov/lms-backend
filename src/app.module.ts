import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
	appConfig,
	dbConfig,
	imageStorageConfig,
	interviewTranscriptionConfig,
	jwtConfig,
	otpBotConfig,
	otpConfig,
	redisConfig,
	s3Config,
	tensordockConfig,
	yookassaConfig,
	subscriptionConfig,
	subscriptionBillingConfig,
} from './config';
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
import { SubscriptionModule } from './subscription/subscription.module';
import { SubscriptionTierModule } from './subscription-tier/subscription-tier.module';
import { YookassaModule } from './yookassa/yookassa.module';
import { PaymentModule } from './payment/payment.module';
import { PostModule } from './post/post.module';
import { InterviewTranscriptionModule } from './interview-transcription/interview-transcription.module';

@Module({
	imports: [
		ConfigModule.forRoot({
			load: [
				appConfig,
				dbConfig,
				imageStorageConfig,
				interviewTranscriptionConfig,
				jwtConfig,
				otpBotConfig,
				otpConfig,
				redisConfig,
				s3Config,
				tensordockConfig,
				yookassaConfig,
				subscriptionConfig,
				subscriptionBillingConfig,
			],
			isGlobal: true,
		}),
		FeedbackModule,
		HrConnectionModule,
		ImageModule.forRoot({ useRealStorageAdapters: true }),
		InfraModule.forRoot({ useRedisTLS: true }),
		InterviewModule,
		InterviewTranscriptionModule.forRoot({ useFakeVmOrchestrator: false }),
		JournalRecordModule,
		MarkdownContentModule,
		MaterialModule,
		MetricsModule,
		SubjectModule,
		TaskModule,
		TelegramModule.forRoot({ useTelegramAPI: true }),
		YookassaModule.forRoot({ useYookassaAPI: true }),
		SubscriptionTierModule,
		SubscriptionModule,
		PaymentModule,
		UserModule,
		VideoModule,
		PostModule,
	],
	controllers: [],
	providers: [],
})
export class AppModule {}
