import { Injectable, Inject, OnModuleInit, LoggerService } from '@nestjs/common';
import { otpBotConfig } from '../../config';
import * as TelegramBot from 'node-telegram-bot-api';
import { ConfigType } from '@nestjs/config';
import { LOGGER_INSTANCE } from '../../infra/constants';

@Injectable()
export class TelegramService implements OnModuleInit {
	private readonly _bot: TelegramBot;

	constructor(
		@Inject(otpBotConfig.KEY)
		private readonly config: ConfigType<typeof otpBotConfig>,
		@Inject(LOGGER_INSTANCE)
		private readonly logger: LoggerService,
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
