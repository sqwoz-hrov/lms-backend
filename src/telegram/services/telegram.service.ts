import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import * as TelegramBot from 'node-telegram-bot-api';
import { otpBotConfig } from '../../config';

@Injectable()
export class TelegramService implements OnModuleInit {
	private readonly _bot: TelegramBot;
	private readonly logger = new Logger(TelegramService.name);

	constructor(
		@Inject(otpBotConfig.KEY)
		private readonly config: ConfigType<typeof otpBotConfig>,
	) {
		const request = this.config.httpProxyUrl
			? ({
					proxy: this.config.httpProxyUrl,
				} as TelegramBot.ConstructorOptions['request'])
			: undefined;

		const botOptions: TelegramBot.ConstructorOptions = {
			...(request && { request }),
		};

		this._bot = new TelegramBot(this.config.botToken, botOptions);
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
