import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class DowngradeSubscriptionDto {
	@ApiProperty({ format: 'uuid', description: 'Целевой тариф подписки' })
	@IsUUID()
	subscriptionTierId: string;
}
