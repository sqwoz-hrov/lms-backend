import { Injectable } from '@nestjs/common';
import { UserSignupAdapter } from '../../users/adapters/user-signup.adapter';
import { TelegramAdapter } from '../adapters/telegram.adapter';

@Injectable()
export class TelegramWebhookUsecase {
	constructor(
		private readonly userSignupAdapter: UserSignupAdapter,
		private readonly telegramAdapter: TelegramAdapter,
	) {}

	public async execute(telegram_username: string, telegram_id: number) {
		const signupComplete = await this.userSignupAdapter.checkUserFinishedSignup(telegram_username);
		if (signupComplete) {
			return;
		}

		await this.userSignupAdapter.setTelegramId(telegram_username, telegram_id);

		await this.telegramAdapter.sendMessage(telegram_id, 'Вы зарегистрированы');
	}
}
