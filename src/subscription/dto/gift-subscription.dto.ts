import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class GiftSubscriptionDto {
	@ApiProperty({ format: 'uuid', description: 'Идентификатор пользователя, которому выдается подписка' })
	@IsUUID()
	userId: string;

	@ApiProperty({ format: 'uuid', description: 'Идентификатор тарифа подписки' })
	@IsUUID()
	subscriptionTierId: string;

	@ApiProperty({
		description: 'Длительность подарка в днях',
		minimum: 1,
		maximum: 365,
		default: 30,
	})
	@IsInt()
	@Min(1)
	@Max(365)
	@IsOptional()
	durationDays?: number = 30;
}
