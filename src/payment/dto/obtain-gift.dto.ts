import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class ObtainGiftDto {
	@ApiProperty({ format: 'uuid' })
	@IsUUID()
	current_tier_id: string;
}

export class ObtainGiftResponseDto {
	@ApiProperty({ format: 'uuid' })
	giftId: string;

	@ApiProperty()
	durationDays: number;
}
