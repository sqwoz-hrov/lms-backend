import { Inject, Injectable } from '@nestjs/common';
import { UserSignupAdapter } from '../../users/adapters/user-signup.adapter';
import { TELEGRAM_ADAPTER } from '../constants';
import { TelegramAdapter } from '../adapters/telegram.adapter';

@Injectable()
export class TelegramWebhookUsecase {
	constructor(
		private readonly userSignupAdapter: UserSignupAdapter,
		@Inject(TELEGRAM_ADAPTER)
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
