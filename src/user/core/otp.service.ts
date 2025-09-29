import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { OTP } from './otp';
import { IOTPStorage } from '../ports/otp-storage.port';
import { OTPRedisStorage } from '../adapters/otp-storage.adapter';

@Injectable()
export class OTPService {
	private readonly logger = new Logger(OTPService.name);

	constructor(@Inject(OTPRedisStorage) private readonly otpStorage: IOTPStorage) {}

	private maskOtp(otpString: string): string {
		const maskedOtp = otpString.replace(/./g, '*');
		return maskedOtp;
	}

	private generateOtp() {
		const bytes = randomBytes(4);
		const value = (bytes.readUInt32BE(0) % 900000) + 100000;
		const digitsString = value.toString();
		this.logger.log('Generated OTP:', this.maskOtp(digitsString));
		return new OTP(digitsString);
	}

	async createOtp(userId: string) {
		const newOtp = this.generateOtp();
		await this.otpStorage.setOtp({ userId, otp: newOtp });
		return newOtp;
	}

	async isOtpValid({ userId, userInputOtp }: { userId: string; userInputOtp: OTP }): Promise<boolean> {
		const actualOtp = await this.otpStorage.getOtp(userId);
		if (!actualOtp) {
			return false;
		}

		return actualOtp.isEqual(userInputOtp);
	}
}
