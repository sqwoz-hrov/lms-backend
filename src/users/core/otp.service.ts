import { Inject, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { promisify } from 'node:util';

import { OTP } from './otp';

import { IOTPStorage } from '../ports/otp-storage.port';
import { OTPRedisStorage } from '../adapters/otp-storage.adapter';

const randomBytesAsync = promisify(randomBytes);

@Injectable()
export class OTPService {
	constructor(@Inject(OTPRedisStorage.name) private readonly otpStorage: IOTPStorage) {}

	private async generateOtp() {
		const buf = await randomBytesAsync(3);
		const digitsString = parseInt(buf.toString('hex'), 10).toString().substr(0, 6);
		return new OTP(digitsString);
	}

	async createOtp(userId: string) {
		const newOtp = await this.generateOtp();
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
