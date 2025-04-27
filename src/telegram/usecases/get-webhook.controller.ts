import { Body, Controller, Injectable, Post } from '@nestjs/common';
import { TelegramWebhookUsecase } from './get-webhook.usecase';
import { Update } from 'node-telegram-bot-api';

@Injectable()
@Controller('/webhooks/telegram')
export class TelegramWebhookController {
	constructor(private readonly usecase: TelegramWebhookUsecase) {}
	@Post()
	async handleUpdate(@Body() update: Update) {
		if (update?.message?.from?.username) {
			await this.usecase.execute(update.message.from.username, update.message.from.id);
		}
	}
}
