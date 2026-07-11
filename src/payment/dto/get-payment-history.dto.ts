import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsPositive, Max } from 'class-validator';

export class GetPaymentHistoryDto {
	@ApiPropertyOptional({
		description: 'Page number',
		default: 1,
		minimum: 1,
	})
	@Type(() => Number)
	@IsInt()
	@IsPositive()
	@IsOptional()
	page?: number;

	@ApiPropertyOptional({
		description: 'Page size',
		default: 20,
		minimum: 1,
		maximum: 100,
	})
	@Type(() => Number)
	@IsInt()
	@IsPositive()
	@Max(100)
	@IsOptional()
	pageSize?: number;
}
