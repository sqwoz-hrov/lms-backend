import { Inject } from '@nestjs/common';
import { User } from '../user.entity';
import { UserRepository } from '../user.repository';

export class UserSignupAdapter {
	constructor(@Inject(UserRepository) private readonly userRepository: UserRepository) {}

	private isSignUpComplete(user: User) {
		return !!user.telegram_id;
	}

	public async checkUserFinishedSignup(
		telegramUsername: User['telegram_username'],
	): Promise<(User & { telegram_id: number }) | undefined> {
		const user = await this.userRepository.findByTelegramUsername(telegramUsername);
		if (!user) {
			return undefined;
		}

		const isSignupComplete = this.isSignUpComplete(user);
		if (!isSignupComplete) {
			return undefined;
		}
		return user as User & { telegram_id: number };
	}

	public async setTelegramId(telegramUsername: string, telegramId: number): Promise<void> {
		const user = await this.userRepository.findByTelegramUsername(telegramUsername);
		if (!user) {
			throw new Error('User not found');
		}

		user.telegram_id = telegramId;
		await this.userRepository.update(user);
	}
}
