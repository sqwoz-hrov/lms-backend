import { Inject, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';

import { OTP } from './otp';

import { IOTPStorage } from '../ports/otp-storage.port';
import { OTPRedisStorage } from '../adapters/otp-storage.adapter';

@Injectable()
export class OTPService {
	constructor(@Inject(OTPRedisStorage) private readonly otpStorage: IOTPStorage) {}

	private generateOtp() {
		const bytes = randomBytes(4);
		const value = bytes.readUInt32BE(0) % 1000000;
		const digitsString = value.toString().padStart(6, '0');
		console.log('Generated OTP:', digitsString);
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
