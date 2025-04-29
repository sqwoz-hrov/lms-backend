import { Injectable, Inject } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface';
import { UserRepository } from '../../user.repository';
import { User } from '../../user.entity';
import { IOTPSender } from '../../ports/otp-sender.port';
import { OTPService } from '../../core/otp.service';
import { TELEGRAM_ADAPTER } from '../../../telegram/constants';

@Injectable()
export class AskForLoginUsecase implements UsecaseInterface {
	constructor(
		private readonly repo: UserRepository,
		private readonly otpService: OTPService,
		@Inject(TELEGRAM_ADAPTER) private readonly otpSender: IOTPSender<'telegram'>,
	) {}

	private isSignupFinished(user: User | undefined): user is User & { telegram_id: number } {
		if (!user) {
			return false;
		}

		if (user.telegram_id) {
			return true;
		}

		return false;
	}

	public async execute({ emailOrLogin }: { emailOrLogin: string }): Promise<{ success: boolean }> {
		const userModel = await this.repo.findByEmail(emailOrLogin);

		const userSignupFinished = this.isSignupFinished(userModel);

		if (userSignupFinished) {
			const otp = await this.otpService.createOtp(userModel.id);
			const res = await this.otpSender.sendOTP(
				{
					telegram_id: userModel.telegram_id,
				},
				otp,
			);
			return { success: res };
		}

		return { success: false };
	}
}
