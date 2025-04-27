import { Module } from '@nestjs/common';
import { TelegramWebhookController } from './usecases/get-webhook.controller';
import { TelegramWebhookUsecase } from './usecases/get-webhook.usecase';
import { TelegramService } from './services/telegram.service';
import { TelegramAdapter } from './adapters/telegram.adapter';

@Module({
	imports: [],
	controllers: [TelegramWebhookController],
	providers: [TelegramAdapter, TelegramService, TelegramWebhookUsecase],
	exports: [TelegramAdapter],
})
export class TelegramModule {}

// SIGNUP
// We save mf to a database, signup state incomplete
// Guy starts the bot
// If his signup is not complete
// We check his handle. If handle is present in our DB,
// remember his tg id. Signup complete, send him a message like "we know you now"

// SIGNIN
// Prerequisite: guy signup'd
// We send to chat with his ID an OTP password
// If he enters coorectly, let him in. If not, re-send
