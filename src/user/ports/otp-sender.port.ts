import { User } from '../user.entity';
import { OTP } from '../core/otp';

export interface IOTPSender<T extends 'telegram' | 'email'> {
	sendOTP(to: T extends 'telegram' ? Pick<User, 'telegram_id'> : Pick<User, 'email'>, otp: OTP): Promise<boolean>;
	// confirmSignup(to: User): Promise<boolean>;
}
