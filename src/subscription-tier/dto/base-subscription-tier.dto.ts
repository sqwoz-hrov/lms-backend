import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsInt, IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class BaseSubscriptionTierDto {
	@ApiProperty()
	@IsString()
	@IsNotEmpty()
	id: string;

	@ApiProperty()
	@IsString()
	@IsNotEmpty()
	tier: string;

	@ApiProperty()
	@IsInt()
	power: number;

	@ApiProperty({ type: [String] })
	@IsArray()
	@IsString({ each: true })
	permissions: string[];

	@ApiProperty()
	@IsNumber()
	price_rubles: number;
}

export class SubscriptionTierResponseDto extends BaseSubscriptionTierDto {}
