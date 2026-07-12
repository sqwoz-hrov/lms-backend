import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

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

	@ApiProperty({ required: false, nullable: true })
	@IsOptional()
	@IsString()
	markdown_description?: string | null;
}

export class SubscriptionTierResponseDto extends BaseSubscriptionTierDto {}
