import TelegramBot from 'node-telegram-bot-api';
import { Logger, LoggerService, Injectable, Inject } from '@nestjs/common';

import { TelegramService } from '../services/telegram.service';
import { IOTPSender } from '../../users/ports/otp-sender.port';
import { OTP } from '../../users/core/otp';

@Injectable()
export class TelegramAdapter implements IOTPSender<'telegram'> {
	bot: TelegramBot;
	constructor(
		private readonly telegramService: TelegramService,
		@Inject(Logger.name) private readonly logger: LoggerService,
	) {
		this.bot = telegramService.bot;
	}

	public async sendMessage(
		chatId: string | number,
		text: string,
		options?: TelegramBot.SendMessageOptions,
	): Promise<TelegramBot.Message> {
		return this.bot.sendMessage(chatId, text, options);
	}

	public async sendOTP(to: { telegram_id: number }, otp: OTP): Promise<boolean> {
		const text = `Ваш код для авторизации: ${otp.asString}`;
		try {
			await this.sendMessage(to.telegram_id, text);
			return true;
		} catch (error) {
			this.logger.error(`Error while sending OTP, ${error}`);
			return false;
		}
	}
}
