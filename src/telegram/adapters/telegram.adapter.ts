import { Injectable, Logger } from '@nestjs/common';
import TelegramBot from 'node-telegram-bot-api';
import { TelegramService } from '../../telegram/services/telegram.service';
import { OTP } from '../../user/core/otp';
import { IOTPSender } from '../../user/ports/otp-sender.port';
import { Retryable } from '../../common/decorators/retryable.decorator';
import { RetryableError } from '../../common/errors/retryable.error';

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
			await this.sendMessageInternal(chatId, text, options);
			return true;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			const stackTrace = error instanceof Error ? error.stack : undefined;
			this.logger.error(`Error while sending message to Telegram, ${errorMessage}`, stackTrace);
			return false;
		}
	}

	public async sendOTP(to: { telegram_id: number }, otp: OTP): Promise<boolean> {
		const text = `Ваш код для авторизации: ${otp.asString}`;
		const isSent = await this.sendMessage(to.telegram_id, text);
		if (!isSent) {
			this.logger.error('Error while sending OTP via Telegram');
		}
		return isSent;
	}

	@Retryable({
		maxAttempts: 3,
		initialDelayMs: 250,
		backoffMultiplier: 2,
	})
	private async sendMessageInternal(
		chatId: string | number,
		text: string,
		options?: TelegramBot.SendMessageOptions,
	): Promise<void> {
		try {
			await this.bot.sendMessage(chatId, text, options);
		} catch (error) {
			if (this.isRecoverableNetworkError(error)) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				const stackTrace = error instanceof Error ? error.stack : undefined;
				this.logger.warn(`Recoverable Telegram send error detected, retrying: ${errorMessage}`, stackTrace);
				throw new RetryableError('Recoverable Telegram send error', { cause: error as Error });
			}
			throw error;
		}
	}

	private isRecoverableNetworkError(error: unknown): boolean {
		if (!error || typeof error !== 'object') {
			return false;
		}

		const { code, errno, message, cause } = error as {
			code?: string;
			errno?: string | number;
			message?: string;
			cause?: unknown;
		};

		if (code !== 'EFATAL') {
			return false;
		}

		if (typeof errno === 'string' && errno.toUpperCase() === 'ECONNRESET') {
			return true;
		}

		if (typeof cause === 'object' && cause !== null) {
			const { code: causeCode, errno: causeErrno } = cause as {
				code?: string;
				errno?: string | number;
			};
			if (
				(typeof causeCode === 'string' && causeCode.toUpperCase() === 'ECONNRESET') ||
				(typeof causeErrno === 'string' && causeErrno.toUpperCase() === 'ECONNRESET')
			) {
				return true;
			}
		}

		// Some versions of node-telegram-bot-api only expose ECONNRESET within the message.
		if (typeof message === 'string' && message.toUpperCase().includes('ECONNRESET')) {
			return true;
		}

		return false;
	}
}
