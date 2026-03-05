import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsPositive, IsString, IsUUID, Max } from 'class-validator';

export class GetPostsDto {
	@ApiPropertyOptional({
		description: 'Загрузить посты после курсора (opaque string)',
	})
	@IsString()
	@IsOptional()
	after?: string;

	@ApiPropertyOptional({
		description: 'Загрузить посты до курсора (opaque string)',
	})
	@IsString()
	@IsOptional()
	before?: string;

	@ApiPropertyOptional({
		description: 'Максимальное количество записей',
		minimum: 1,
		maximum: 100,
	})
	@Type(() => Number)
	@IsInt()
	@IsPositive()
	@Max(100)
	@IsOptional()
	limit?: number;

	@ApiPropertyOptional({
		description: 'Фильтр по подписочному уровню',
		format: 'uuid',
	})
	@IsUUID()
	@IsOptional()
	subscription_tier_id?: string;
}
