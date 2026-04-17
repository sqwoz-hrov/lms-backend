import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsString, Min } from 'class-validator';
import { LIMIT_PERIODS, LIMITABLE_RESOURCES, LimitPeriod, LimitableResource } from '../core/limits.domain';

export class LimitDto {
	@ApiProperty({ enum: LIMITABLE_RESOURCES })
	@IsEnum(LIMITABLE_RESOURCES)
	feature: LimitableResource;

	@ApiProperty({ enum: LIMIT_PERIODS })
	@IsEnum(LIMIT_PERIODS)
	period: LimitPeriod;

	@ApiProperty()
	@IsInt()
	@Min(1)
	limit: number;

	@ApiProperty()
	@IsString()
	name: string;
}

export class LimitsResponseDto {
	@ApiProperty({ type: () => LimitDto, isArray: true })
	applied: LimitDto[];

	@ApiProperty({ type: () => LimitDto, isArray: true })
	exceeded: LimitDto[];
}
