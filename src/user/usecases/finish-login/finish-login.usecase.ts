import { Injectable } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { OTPService } from '../../core/otp.service';
import { OTP } from '../../core/otp';
import { UserRepository } from '../../user.repository';
import { JwtService } from '../../../infra/services/jwt.service';

@Injectable()
export class FinishLoginUsecase implements UsecaseInterface {
	constructor(
		private readonly otpService: OTPService,
		private readonly repo: UserRepository,
		private readonly jwtService: JwtService,
	) {}

	public async execute({ inputOtp, userEmailOrLogin }: { inputOtp: OTP; userEmailOrLogin: string }): Promise<
		| { success: false }
		| {
				success: true;
				data: {
					accessToken: string;
					refreshToken: string;
					accessTtlMs: number;
					refreshTtlMs: number;
				};
		  }
	> {
		const userOrUndefined = await this.repo.findByEmail(userEmailOrLogin);

		if (!userOrUndefined) {
			return { success: false };
		}

		const isValid = await this.otpService.isOtpValid({
			userId: userOrUndefined.id,
			userInputOtp: inputOtp,
		});

		if (!isValid) {
			return { success: false };
		}

		const { accessToken, refreshToken, accessTtlMs, refreshTtlMs } = this.jwtService.generatePair({
			userId: userOrUndefined.id,
		});

		return {
			success: true,
			data: { accessToken, refreshToken, accessTtlMs, refreshTtlMs },
		};
	}
}
