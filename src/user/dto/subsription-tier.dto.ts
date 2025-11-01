import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class SubscriptionTierDto {
	@ApiProperty({ description: 'Subscription tier identifier' })
	@IsString()
	@IsNotEmpty()
	id: string;

	@ApiProperty({ description: 'Subscription tier name' })
	@IsString()
	@IsNotEmpty()
	tier: string;

	@ApiProperty({ description: 'Subsription tier price' })
	@IsNumber()
	price_rubles: number;

	@ApiProperty({ description: 'Subscription tier power' })
	@IsNumber()
	@IsNotEmpty()
	power: number;

	@ApiProperty({ description: 'Granted permissions', type: [String] })
	@IsArray()
	@IsString({ each: true })
	permissions: string[];
}
