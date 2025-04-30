import { Injectable } from '@nestjs/common';

import { UsecaseInterface } from '../../../common/interface';

import { OTPService } from '../../core/otp.service';
import { OTP } from '../../core/otp';
import { UserRepository } from '../../user.repository';
import { JwtService } from '../../core/jwt.service';

@Injectable()
export class FinishLoginUsecase implements UsecaseInterface {
	constructor(
		private readonly otpService: OTPService,
		private readonly repo: UserRepository,
		private readonly jwtService: JwtService,
	) {}
	public async execute({
		inputOtp,
		userEmailOrLogin,
	}: {
		inputOtp: OTP;
		userEmailOrLogin: string;
	}): Promise<{ success: false } | { success: true; data: { token: string } }> {
		// If he enters coorectly, let him in. If not, from client we can re-send OTP
		const userOrUndefined = await this.repo.findByEmail(userEmailOrLogin);

		if (!userOrUndefined) {
			return { success: false };
		}

		const res = await this.otpService.isOtpValid({ userId: userOrUndefined.id, userInputOtp: inputOtp });

		if (!res) {
			return { success: false };
		}

		const token = this.jwtService.generate({ userId: userOrUndefined.id });

		return { success: true, data: { token } };
	}
}
