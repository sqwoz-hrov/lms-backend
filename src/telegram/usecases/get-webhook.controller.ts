import { Body, Controller, Injectable, Post } from '@nestjs/common';
import { TelegramWebhookUsecase } from './get-webhook.usecase';
import { Update } from 'node-telegram-bot-api';
import { Route } from '../../common/nest/decorators/route.decorator';
import { ApiTags } from '@nestjs/swagger';

@Injectable()
@ApiTags('Webhooks')
@Controller('/webhooks/telegram')
export class TelegramWebhookController {
	constructor(private readonly usecase: TelegramWebhookUsecase) {}

	@Route({ summary: 'Обработка вебхука от Telegram', description: 'Обработка вебхука от Telegram' })
	@Post()
	async handleUpdate(@Body() update: Update) {
		if (update?.message?.from?.username) {
			await this.usecase.execute(update.message.from.username, update.message.from.id);
		}
	}
}
