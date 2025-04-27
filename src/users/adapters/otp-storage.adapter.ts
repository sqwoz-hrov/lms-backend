import { Injectable, Inject } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { Redis } from 'ioredis';

import { IOTPStorage } from '../ports/otp-storage.port';
import { OTP } from '../core/otp';
import { otpConfig } from '../../configs/otp.config';

import { REDIS_CONNECTION_KEY } from '../../infra/redis.const';

@Injectable()
export class OTPRedisStorage implements IOTPStorage {
	constructor(
		@Inject(REDIS_CONNECTION_KEY) private readonly redis: Redis,
		@Inject(otpConfig.KEY) private readonly config: ConfigType<typeof otpConfig>,
	) {}

	async setOtp({ userId, otp }: { userId: string; otp: OTP }): Promise<boolean> {
		const isOk = await this.redis.set(userId, otp.asString, 'EX', this.config.otpTtlSeconds, 'NX');
		return !!isOk;
	}

	async getOtp(userId: string): Promise<OTP | undefined> {
		const otpStrOrNull = await this.redis.get(userId);

		if (!otpStrOrNull) {
			return undefined;
		}

		return new OTP(otpStrOrNull);
	}
}
