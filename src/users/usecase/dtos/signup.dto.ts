import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

import { UserRole } from '../../user.entity';

const UserRoles: UserRole[] = ['admin', 'user'];

export class BaseUserDto {
	@ApiProperty({ description: 'Unique user identifier' })
	@IsString()
	@IsNotEmpty()
	id: string;

	@ApiProperty({ enum: UserRoles, description: 'User role' })
	@IsEnum(UserRoles)
	@IsNotEmpty()
	role: UserRole;

	@ApiProperty({ description: 'User name' })
	@IsString()
	@IsNotEmpty()
	name: string;

	@ApiProperty({ description: 'User email' })
	@IsEmail()
	@IsNotEmpty()
	email: string;

	@ApiPropertyOptional({ description: 'User Telegram ID', type: Number })
	@IsNumber()
	@IsOptional()
	telegram_id?: number;

	@ApiProperty({ description: 'User Telegram username' })
	@IsString()
	@IsNotEmpty()
	telegram_username: string;
}

export class CreateUserDto extends OmitType(BaseUserDto, ['id', 'telegram_id']) {}

export class UpdateUserDto extends OmitType(BaseUserDto, ['id']) {}

export class UserResponseDto extends BaseUserDto {}
