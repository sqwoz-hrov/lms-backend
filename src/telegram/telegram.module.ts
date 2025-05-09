import { DynamicModule, Module } from '@nestjs/common';
import { TelegramWebhookController } from '../telegram/usecases/get-webhook.controller';
import { TelegramWebhookUsecase } from '../telegram/usecases/get-webhook.usecase';
import { TelegramService } from '../telegram/services/telegram.service';
import { TelegramAdapter } from '../telegram/adapters/telegram.adapter';
import { FakeTelegramAdapter } from './adapters/fake-telegram.adapter';
import { TELEGRAM_ADAPTER } from './constants';
import { UserModule } from '../user/user.module';

@Module({})
export class TelegramModule {
	static forRoot({ useTelegramAPI }: { useTelegramAPI: boolean }): DynamicModule {
		if (useTelegramAPI) {
			return {
				module: TelegramModule,
				global: true,
				imports: [UserModule],
				controllers: [TelegramWebhookController],
				providers: [{ provide: TELEGRAM_ADAPTER, useClass: TelegramAdapter }, TelegramService, TelegramWebhookUsecase],
				exports: [TELEGRAM_ADAPTER],
			};
		}
		return {
			module: TelegramModule,
			global: true,
			providers: [{ provide: TELEGRAM_ADAPTER, useClass: FakeTelegramAdapter }],
			exports: [TELEGRAM_ADAPTER],
		};
	}
}
