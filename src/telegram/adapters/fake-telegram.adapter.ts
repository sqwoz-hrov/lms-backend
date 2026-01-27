import { Logger } from '@nestjs/common';
import { OTP } from '../../user/core/otp';
import { IOTPSender } from '../../user/ports/otp-sender.port';

export class FakeTelegramAdapter implements IOTPSender<'telegram'> {
	private readonly logger = new Logger(FakeTelegramAdapter.name);
	public sendMessage(): Promise<boolean> {
		return Promise.resolve(true);
	}

	public sendOTP(to: { telegram_id: number }, otp: OTP): Promise<boolean> {
		this.logger.log(`Sending OTP ${otp.asString} to Telegram user ${to.telegram_id}`);
		return Promise.resolve(true);
	}
}
