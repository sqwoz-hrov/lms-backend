import { IsEmail } from 'class-validator';

export class AskLoginDto {
	@IsEmail()
	email: string;
}
