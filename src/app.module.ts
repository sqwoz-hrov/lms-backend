import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { dbConfig, jwtConfig, otpBotConfig, otpConfig } from './config';
import { UserModule } from './users/user.module';
import { TelegramModule } from './telegram/telegram.module';
import { InfraModule } from './infra/infra.module';

@Module({
	imports: [
		ConfigModule.forRoot({
			load: [dbConfig, jwtConfig, otpBotConfig, otpConfig],
			isGlobal: true,
		}),
		InfraModule,
		TelegramModule,
		UserModule,
	],
	controllers: [],
	providers: [],
})
export class AppModule {}
