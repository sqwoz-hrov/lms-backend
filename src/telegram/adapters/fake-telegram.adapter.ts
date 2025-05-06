import { IOTPSender } from '../../user/ports/otp-sender.port';

export class FakeTelegramAdapter implements IOTPSender<'telegram'> {
	public sendMessage(): Promise<boolean> {
		return Promise.resolve(true);
	}

	public sendOTP(): Promise<boolean> {
		return Promise.resolve(true);
	}
}
