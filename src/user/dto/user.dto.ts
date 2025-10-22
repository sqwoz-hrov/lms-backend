import { ApiProperty, ApiPropertyOptional, OmitType, PickType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	IsBoolean,
	IsDate,
	IsEmail,
	IsEnum,
	IsNotEmpty,
	IsNumber,
	IsOptional,
	IsString,
	IsUUID,
	ValidateNested,
} from 'class-validator';
import { UserRole, UserWithSubscriptionTier } from '../user.entity';
import { SubscriptionTierDto } from './subsription-tier.dto';
import { string } from 'zod';

const UserRoles: UserRole[] = ['admin', 'user', 'subscriber'];

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

	@ApiPropertyOptional({ description: 'Subscription tier identifier', nullable: true })
	@IsUUID()
	@IsOptional()
	subscription_tier_id?: string | null;

	@ApiPropertyOptional({
		description: 'Subscription active until date',
		type: String,
		format: 'date-time',
		nullable: true,
	})
	@Type(() => string)
	@IsDate()
	@IsOptional()
	active_until?: string | null;

	@ApiPropertyOptional({ description: 'Indicates whether user is billable' })
	@IsBoolean()
	@IsOptional()
	is_billable?: boolean;

	@ApiPropertyOptional({ description: 'Indicates whether user is archived' })
	@IsBoolean()
	@IsOptional()
	is_archived?: boolean;
}

export class CreateUserDto extends OmitType(BaseUserDto, ['id', 'telegram_id', 'active_until', 'is_archived']) {}

export class PublicSignupDto extends PickType(BaseUserDto, ['name', 'email', 'telegram_username']) {}

export class UpdateUserDto extends OmitType(BaseUserDto, ['id']) {}

export class UserResponseDto extends BaseUserDto {
	@ApiPropertyOptional({
		description: 'Subscription tier information',
		type: () => SubscriptionTierDto,
		nullable: true,
	})
	@ValidateNested()
	@Type(() => SubscriptionTierDto)
	@IsOptional()
	subscription_tier?: SubscriptionTierDto | null;
}

export const toUserResponseDto = (user: UserWithSubscriptionTier): UserResponseDto => ({
	id: user.id,
	role: user.role,
	name: user.name,
	email: user.email,
	telegram_id: user.telegram_id ?? undefined,
	telegram_username: user.telegram_username,
	subscription_tier_id: user.subscription_tier_id ?? null,
	active_until: user.active_until?.toISOString() ?? null,
	is_billable: user.is_billable,
	is_archived: user.is_archived,
	subscription_tier: user.subscription_tier
		? {
				id: user.subscription_tier.id,
				tier: user.subscription_tier.tier,
				permissions: user.subscription_tier.permissions ?? [],
			}
		: null,
});
