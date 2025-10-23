import { Injectable } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { OTP } from '../../core/otp';
import { OTPService } from '../../core/otp.service';
import { UserRepository } from '../../user.repository';

@Injectable()
export class FinishRegistrationUsecase implements UsecaseInterface {
	constructor(
		private readonly otpService: OTPService,
		private readonly repo: UserRepository,
	) {}

	public async execute({ inputOtp, email }: { inputOtp: OTP; email: string }): Promise<{ success: boolean }> {
		const user = await this.repo.findByEmail(email);
		if (!user) return { success: false };

		const isValid = await this.otpService.isOtpValid({
			userId: user.id,
			userInputOtp: inputOtp,
		});

		if (!isValid) {
			return { success: false };
		}

		if (!user.finished_registration) {
			user.finished_registration = true;
			await this.repo.update(user);
		}

		return { success: true };
	}
}
