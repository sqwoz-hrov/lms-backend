import { registerAs } from '@nestjs/config';
import { get } from 'env-var';

export const otpBotConfig = registerAs('otpBot', () => ({
	botToken: get('OTP_BOT_TOKEN').required().asString(),
	webhookUrl: get('OTP_BOT_WEBHOOK_URL').required().asString(),
}));
