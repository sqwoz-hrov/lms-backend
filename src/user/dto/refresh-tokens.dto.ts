import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsString } from 'class-validator';

export class LogoutDto {
	@ApiProperty({ example: true, description: 'Refresh both tokens or access only' })
	@IsBoolean()
	all?: boolean;

	@ApiProperty({ example: 'your_token', description: "Your refresh token if you don't wanna pass it in cookies" })
	@IsString()
	fallbackRefreshToken?: string;
}
