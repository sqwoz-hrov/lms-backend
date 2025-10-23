import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsNumber } from 'class-validator';

export class FinishRegistrationDto {
	@ApiProperty({ example: 'user@example.com', description: 'User email address' })
	@IsEmail()
	email: string;

	@ApiProperty({ example: 123456, description: 'One-time password code' })
	@IsNumber()
	@IsNotEmpty()
	otpCode: number;
}
