import { registerAs } from '@nestjs/config';
import { get } from 'env-var';

export const otpConfig = registerAs('otp', () => ({
	otpTtlSeconds: get('OTP_TTL_SECONDS').required().asIntPositive(),
}));
