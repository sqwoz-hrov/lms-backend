import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class SendOtpDto {
	@ApiProperty({
		description: 'Email для отправки одноразового пароля',
		example: 'user@example.com',
	})
	@IsEmail()
	email: string;
}

export class SendOtpResponseDto {
	@ApiProperty({
		description: 'Статус отправки OTP через Telegram',
		enum: ['otp_sent', 'pending_contact', 'delivery_failed'],
	})
	status: 'otp_sent' | 'pending_contact' | 'delivery_failed';
}
