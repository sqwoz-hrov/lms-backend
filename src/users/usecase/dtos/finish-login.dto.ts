import { IsEmail, IsString, IsNotEmpty } from 'class-validator';
import { Transform, Type } from 'class-transformer';

import { OTP } from '../../core/otp';

export class FinishLoginDto {
	@IsEmail()
	email: string;

	@Transform(({ value }) => new OTP(value))
	@IsString()
	@IsNotEmpty()
	@Type(() => String)
	otpCode: OTP;
}
