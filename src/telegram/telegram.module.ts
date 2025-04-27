import { forwardRef, Module } from '@nestjs/common';
import { TelegramWebhookController } from '../telegram/usecases/get-webhook.controller';
import { TelegramWebhookUsecase } from '../telegram/usecases/get-webhook.usecase';
import { TelegramService } from '../telegram/services/telegram.service';
import { TelegramAdapter } from '../telegram/adapters/telegram.adapter';
import { InfraModule } from '../infra/infra.module';
import { UserModule } from '../users/user.module';

@Module({
	imports: [InfraModule, forwardRef(() => UserModule)],
	controllers: [TelegramWebhookController],
	providers: [TelegramAdapter, TelegramService, TelegramWebhookUsecase],
	exports: [TelegramAdapter],
})
export class TelegramModule {}
