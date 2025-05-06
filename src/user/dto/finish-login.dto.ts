import { IsEmail, IsString, IsNumber, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class FinishLoginDto {
	@ApiProperty({ example: 'user@example.com', description: 'User email address' })
	@IsEmail()
	email: string;

	@ApiProperty({ example: 123456, description: 'One-time password code' })
	@IsNumber()
	@IsNotEmpty()
	otpCode: number;
}

export class FinishLoginResponseDto {
	@ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', description: 'JWT access token' })
	@IsString()
	@IsNotEmpty()
	token: string;
}
