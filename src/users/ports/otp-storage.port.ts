import { OTP } from '../core/otp';

export interface IOTPStorage {
	setOtp({ userId, otp }: { userId: string; otp: OTP }): Promise<boolean>;
	getOtp(userId: string): Promise<OTP | undefined>;
}
