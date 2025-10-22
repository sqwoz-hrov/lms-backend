import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsString } from 'class-validator';

export class SubscriptionTierDto {
	@ApiProperty({ description: 'Subscription tier identifier' })
	@IsString()
	@IsNotEmpty()
	id: string;

	@ApiProperty({ description: 'Subscription tier name' })
	@IsString()
	@IsNotEmpty()
	tier: string;

	@ApiProperty({ description: 'Granted permissions', type: [String] })
	@IsArray()
	@IsString({ each: true })
	permissions: string[];
}
