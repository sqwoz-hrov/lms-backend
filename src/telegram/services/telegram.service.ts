import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { otpBotConfig } from '../../configs/otp-bot.config';
import TelegramBot from 'node-telegram-bot-api';
import { ConfigType } from '@nestjs/config';

@Injectable()
export class TelegramService implements OnModuleInit {
	private readonly _bot: TelegramBot;
	private readonly logger = new Logger(TelegramService.name);

	constructor(
		@Inject(otpBotConfig)
		private readonly config: ConfigType<typeof otpBotConfig>,
	) {
		this._bot = new TelegramBot(this.config.botToken);
	}

	get bot() {
		return this._bot;
	}

	async setWebhook() {
		await this._bot.deleteWebHook();
		await this._bot.setWebHook(this.config.webhookUrl);
		this.logger.log(`Webhook set: ${this.config.webhookUrl}`);
	}

	async onModuleInit() {
		this.logger.log(`Logged in as ${(await this._bot.getMe()).username}`);
		await this.setWebhook();
	}
}
