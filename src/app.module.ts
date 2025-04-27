import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { dbConfig, jwtConfig, otpBotConfig, otpConfig } from './config';
import { UserModule } from './users/user.module';
import { TelegramModule } from './telegram/telegram.module';

@Module({
	imports: [
		TelegramModule,
		UserModule,
		ConfigModule.forRoot({
			load: [dbConfig, jwtConfig, otpBotConfig, otpConfig],
			isGlobal: true,
		}),
	],
	controllers: [],
	providers: [],
})
export class AppModule {}
