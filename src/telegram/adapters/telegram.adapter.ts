import TelegramBot from 'node-telegram-bot-api';
import { LoggerService, Injectable, Inject } from '@nestjs/common';
import { TelegramService } from '../../telegram/services/telegram.service';
import { IOTPSender } from '../../users/ports/otp-sender.port';
import { OTP } from '../../users/core/otp';
import { LOGGER_INSTANCE } from '../../infra/constants';

@Injectable()
export class TelegramAdapter implements IOTPSender<'telegram'> {
	bot: TelegramBot;

	constructor(
		telegramService: TelegramService,
		@Inject(LOGGER_INSTANCE) private readonly logger: LoggerService,
	) {
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
