import { Injectable, Logger } from '@nestjs/common';
import TelegramBot from 'node-telegram-bot-api';
import { TelegramService } from '../../telegram/services/telegram.service';
import { OTP } from '../../user/core/otp';
import { IOTPSender } from '../../user/ports/otp-sender.port';

@Injectable()
export class TelegramAdapter implements IOTPSender<'telegram'> {
	bot: TelegramBot;
	private readonly logger = new Logger(TelegramAdapter.name);

	constructor(telegramService: TelegramService) {
		this.bot = telegramService.bot;
	}

	public async sendMessage(
		chatId: string | number,
		text: string,
		options?: TelegramBot.SendMessageOptions,
	): Promise<boolean> {
		try {
			await this.bot.sendMessage(chatId, text, options);
			return true;
		} catch (error) {
			this.logger.error(`Error while sending message to Telegram, ${error}`);
			return false;
		}
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
