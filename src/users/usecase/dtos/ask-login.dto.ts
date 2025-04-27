import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AskLoginDto {
	@ApiProperty({
		description: 'User email address',
		example: 'user@example.com',
	})
	@IsEmail()
	email: string;
}

export class AskLoginResponseDto {}
